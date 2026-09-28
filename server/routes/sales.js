const express = require('express');
const { db, requireAuth, r2, postInvoice, recordPayment, nextNumber, rateFor, productById, createEntry } = require('../lib');

const router = express.Router();
router.use(requireAuth);

/* ============ Invoices & Bills ============ */
router.get('/invoices', (req, res) => {
  const kind = req.query.kind === 'purchase' ? 'purchase' : 'sale';
  const { getBranchCtx } = require('../lib');
  const { bid } = getBranchCtx(req);
  const bSql = bid ? 'AND i.branch_id = ?' : '';
  const bP = bid ? [bid] : [];

  let sql = `
    SELECT i.*, c.name AS contact_name, c.email AS contact_email,
      ROUND(COALESCE(i.total_base, i.total / i.fx_rate),2) AS total_base_eff,
      ROUND(COALESCE((SELECT SUM(base_amount) FROM payments p WHERE p.invoice_id = i.id),0),2) AS paid_base
    FROM invoices i LEFT JOIN contacts c ON c.id = i.contact_id
    WHERE i.company_id = ? ${bSql} AND i.kind = ?`;
  const params = [req.user.company_id, ...bP, kind];
  if (req.query.from) { sql += ' AND i.date >= ?'; params.push(req.query.from); }
  if (req.query.to) { sql += ' AND i.date <= ?'; params.push(req.query.to); }
  if (req.query.contact_id) { sql += ' AND i.contact_id = ?'; params.push(Number(req.query.contact_id)); }
  sql += ' ORDER BY i.date DESC, i.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ invoices: rows });
});

router.get('/invoices/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!inv) return res.status(404).json({ error: 'not_found' });
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
  const payments = db.prepare('SELECT p.*, a.name AS account_name FROM payments p LEFT JOIN accounts a ON a.id = p.account_id WHERE p.invoice_id = ?').all(inv.id);
  res.json({ invoice: inv, items, payments });
});

function buildInvoice(req, res, kind) {
  const { contact_id, date, due_date, currency, fx_rate, tax_rate, memo, items, status } = req.body || {};
  const cid = req.user.company_id;

  const { getEffectiveBranchId } = require('../lib');
  const bid = getEffectiveBranchId(req);
  if (bid === null) return res.status(400).json({ error: 'no_branch_selected' });

  if (!date || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'missing_fields' });
  const cur = currency || 'USD';
  const rate = fx_rate ? Number(fx_rate) : rateFor(cid, cur);
  const taxPct = tax_rate === undefined ? (req.user.tax_enabled ? req.user.tax_rate : 0) : Number(tax_rate);

  /* Each line can be in its own currency: price is in line currency,
     base_amount converts it to the company's base currency. */
  let subtotalBase = 0;
  const rows = [];
  for (const it of items) {
    const qty = Number(it.qty) || 1;
    const lineCur = it.currency || cur;
    const lineFx = it.fx_rate ? Number(it.fx_rate) : rateFor(cid, lineCur);
    const price = Number(it.unit_price) || 0; // in line currency
    const amount = r2(qty * price);           // line currency
    const base = r2(amount / lineFx);         // base currency
    subtotalBase += base;
    rows.push({ product_id: it.product_id || null, description: it.description || '', qty, unit_price: price, amount, base_amount: base, currency: lineCur, fx_rate: lineFx });
  }
  subtotalBase = r2(subtotalBase);
  const taxBase = r2(subtotalBase * taxPct / 100);
  const totalBase = r2(subtotalBase + taxBase);
  /* display totals in the document currency */
  const subtotal = r2(subtotalBase * rate);
  const taxAmount = r2(taxBase * rate);
  const total = r2(totalBase * rate);
  const number = nextNumber(cid, kind === 'sale' ? 'INV' : 'BILL');

  const invId = db.prepare(`INSERT INTO invoices (company_id, branch_id, kind, number, contact_id, date, due_date, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(cid, bid, kind, number, contact_id || null, date, due_date || null, cur, rate, subtotal, taxAmount, total, subtotalBase, taxBase, totalBase, 'draft', memo || '')
    .lastInsertRowid;
  const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, product_id, description, qty, unit_price, amount, base_amount, currency, fx_rate) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const r of rows) insItem.run(invId, r.product_id, r.description, r.qty, r.unit_price, r.amount, r.base_amount, r.currency, r.fx_rate);

  if (status === 'posted') postInvoice(cid, db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId));
  res.json({ invoice: db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) });
}

router.post('/invoices', (req, res) => {
  const kind = req.body?.kind === 'purchase' ? 'purchase' : 'sale';
  buildInvoice(req, res, kind);
});

router.post('/invoices/:id/post', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!inv) return res.status(404).json({ error: 'not_found' });
  if (inv.status !== 'draft') return res.status(400).json({ error: 'already_posted' });
  postInvoice(req.user.company_id, inv);
  res.json({ invoice: db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id) });
});

router.post('/invoices/:id/pay', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!inv) return res.status(404).json({ error: 'not_found' });
  if (inv.status === 'draft') return res.status(400).json({ error: 'not_posted' });
  const { date, amount, account_id, memo } = req.body || {};
  if (!date || !amount || !account_id) return res.status(400).json({ error: 'missing_fields' });
  const acc = db.prepare('SELECT id FROM accounts WHERE id = ? AND company_id = ?').get(account_id, req.user.company_id);
  if (!acc) return res.status(400).json({ error: 'invalid_account' });
  recordPayment(req.user.company_id, inv, { date, amount: Number(amount), accountId: account_id, memo });
  res.json({ invoice: db.prepare('SELECT * FROM invoices WHERE id = ?').get(inv.id) });
});

router.delete('/invoices/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!inv) return res.status(404).json({ error: 'not_found' });
  if (inv.status !== 'draft') return res.status(400).json({ error: 'posted_only_draft' });
  db.prepare('DELETE FROM invoices WHERE id = ?').run(inv.id);
  res.json({ ok: true });
});

/* ============ Invoice Return (Credit Note) ============ */
router.post('/invoices/:id/return', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!inv) return res.status(404).json({ error: 'not_found' });
  if (inv.status === 'draft') return res.status(400).json({ error: 'not_posted' });
  if (inv.kind === 'return_sale' || inv.kind === 'return_purchase') return res.status(400).json({ error: 'cannot_return_return' });

  const { date, items, memo } = req.body || {};
  const cid = req.user.company_id;
  const returnDate = date || new Date().toISOString().slice(0, 10);
  const originalItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);

  // Determine which items to return (default: all)
  const returnItems = items || originalItems.map(it => ({ invoice_item_id: it.id, qty: it.qty }));

  const returnKind = inv.kind === 'sale' ? 'return_sale' : 'return_purchase';
  const prefix = inv.kind === 'sale' ? 'RET' : 'RBILL';
  const n = db.prepare(`SELECT COUNT(*) n FROM invoices WHERE company_id = ? AND kind = ?`).get(cid, returnKind).n + 1;
  const returnNumber = prefix + '-' + String(n).padStart(4, '0');

  // Build return invoice
  let subtotalBase = 0;
  const rows = [];
  for (const ri of returnItems) {
    const orig = originalItems.find(it => it.id === ri.invoice_item_id) || originalItems[0];
    if (!orig) continue;
    const qty = Math.min(Number(ri.qty) || orig.qty, orig.qty);
    const base = r2(orig.base_amount * qty / orig.qty);
    subtotalBase += base;
    rows.push({ product_id: orig.product_id, description: orig.description, qty, unit_price: orig.unit_price, amount: r2(orig.amount * qty / orig.qty), base_amount: base, currency: orig.currency || inv.currency, fx_rate: orig.fx_rate || inv.fx_rate });
  }
  subtotalBase = r2(subtotalBase);
  const taxBase = r2(subtotalBase * (inv.tax_amount / Math.max(inv.subtotal, 0.01)));
  const totalBase = r2(subtotalBase + taxBase);
  const subtotal = r2(subtotalBase * inv.fx_rate);
  const taxAmount = r2(taxBase * inv.fx_rate);
  const total = r2(totalBase * inv.fx_rate);

  const retId = db.prepare(`INSERT INTO invoices (company_id, kind, number, contact_id, date, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo, return_of_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(cid, returnKind, returnNumber, inv.contact_id, returnDate, inv.currency, inv.fx_rate, subtotal, taxAmount, total, subtotalBase, taxBase, totalBase, 'posted', memo || 'مردود: ' + inv.number, inv.id)
    .lastInsertRowid;

  const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, product_id, description, qty, unit_price, amount, base_amount, currency, fx_rate) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const r of rows) insItem.run(retId, r.product_id, r.description, r.qty, r.unit_price, r.amount, r.base_amount, r.currency, r.fx_rate);

  // Reverse inventory and journal
  const coa = { ar: '1100', ap: '2100', revenue: '4000', cogs: '5000', inventory: '1200', tax: '2200' };
  const acc = (code) => db.prepare('SELECT id FROM accounts WHERE company_id=? AND code=?').get(cid, code);
  const lines = [];

  if (inv.kind === 'sale') {
    // Reverse: Dr Revenue, Dr Tax, Cr AR
    lines.push({ account_id: acc(coa.revenue).id, debit: subtotalBase, credit: 0 });
    if (taxBase > 0) lines.push({ account_id: acc(coa.tax).id, debit: taxBase, credit: 0 });
    lines.push({ account_id: acc(coa.ar).id, debit: 0, credit: totalBase });
    // Return inventory
    for (const r of rows) {
      if (!r.product_id) continue;
      const p = productById(r.product_id, cid);
      const cost = p.cost;
      lines.push({ account_id: acc(coa.inventory).id, debit: cost * r.qty, credit: 0 });
      lines.push({ account_id: acc(coa.cogs).id, debit: 0, credit: cost * r.qty });
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(r.qty, p.id);
      db.prepare('INSERT INTO stock_moves (company_id, product_id, date, qty, ref_type, ref_id, unit_cost) VALUES (?,?,?,?,?,?,?)').run(cid, p.id, returnDate, r.qty, 'return', retId, cost);
    }
  } else {
    // Reverse purchase bill: Dr AP, Cr Inventory
    lines.push({ account_id: acc(coa.ap).id, debit: totalBase, credit: 0 });
    lines.push({ account_id: acc(coa.inventory).id, debit: 0, credit: subtotalBase });
    if (taxBase > 0) lines.push({ account_id: acc(coa.tax).id, debit: 0, credit: taxBase });
    for (const r of rows) {
      if (!r.product_id) continue;
      const p = productById(r.product_id, cid);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(r.qty, p.id);
      db.prepare('INSERT INTO stock_moves (company_id, product_id, date, qty, ref_type, ref_id, unit_cost) VALUES (?,?,?,?,?,?,?)').run(cid, p.id, returnDate, -r.qty, 'return', retId, r.unit_price / (r.fx_rate || 1));
    }
  }

  const { createEntry } = require('../lib');
  createEntry(cid, returnDate, 'Return ' + inv.number, returnNumber, 'return', retId, lines);

  res.json({ invoice: db.prepare('SELECT * FROM invoices WHERE id = ?').get(retId) });
});

/* ============ Expenses ============ */
router.get('/expenses', (req, res) => {
  const { getBranchCtx } = require('../lib');
  const { bid } = getBranchCtx(req);
  const bSql = bid ? 'AND e.branch_id = ?' : '';
  const bP = bid ? [bid] : [];

  let sql = `
    SELECT e.*, a.name AS account_name, c.name AS contact_name, pa.name AS payment_account_name
    FROM expenses e
    LEFT JOIN accounts a ON a.id = e.account_id
    LEFT JOIN contacts c ON c.id = e.contact_id
    LEFT JOIN accounts pa ON pa.id = e.payment_account_id
    WHERE e.company_id = ? ${bSql}`;
  const params = [req.user.company_id, ...bP];
  if (req.query.from) { sql += ' AND e.date >= ?'; params.push(req.query.from); }
  if (req.query.to) { sql += ' AND e.date <= ?'; params.push(req.query.to); }
  sql += ' ORDER BY e.date DESC, e.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ expenses: rows });
});

router.post('/expenses', (req, res) => {
  const { date, account_id, contact_id, currency, fx_rate, amount, memo, payment_account_id } = req.body || {};
  const cid = req.user.company_id;

  const { getEffectiveBranchId } = require('../lib');
  const bid = getEffectiveBranchId(req);
  if (bid === null) return res.status(400).json({ error: 'no_branch_selected' });

  if (!date || !account_id || !amount) return res.status(400).json({ error: 'missing_fields' });
  const acc = db.prepare('SELECT id FROM accounts WHERE id = ? AND company_id = ?').get(account_id, cid);
  if (!acc) return res.status(400).json({ error: 'invalid_account' });
  const cur = currency || 'USD';
  const rate = fx_rate ? Number(fx_rate) : rateFor(cid, cur);
  const base = r2(Number(amount) / rate);
  const info = db.prepare(`INSERT INTO expenses (company_id, branch_id, date, account_id, contact_id, currency, fx_rate, amount, base_amount, memo, payment_account_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(cid, bid, date, account_id, contact_id || null, cur, rate, Number(amount), base, memo || '', payment_account_id || null);

  // post: Dr expense account, Cr cash (or specified payment account / AP fallback)
  const defaultCash = db.prepare("SELECT id FROM accounts WHERE company_id=? AND code LIKE '10%' ORDER BY code LIMIT 1").get(cid)?.id
    || db.prepare("SELECT id FROM accounts WHERE company_id=? AND code='2100'").get(cid)?.id;
  const payAcc = payment_account_id || defaultCash;
  const n = db.prepare('SELECT COUNT(*) n FROM journal_entries WHERE company_id = ? AND source = ?').get(cid, 'expense').n;
  const lines = [
    { account_id, debit: base, credit: 0 },
    { account_id: payAcc, debit: 0, credit: base }
  ];
  const { createEntry } = require('../lib');
  createEntry(cid, date, memo || 'Expense', 'EXP-' + String(n + 1).padStart(4, '0'), 'expense', info.lastInsertRowid, lines);
  res.json({ expense: db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid) });
});

/* ============ Edit expense (updates the linked journal entry) ============ */
router.put('/expenses/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM expenses WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!ex) return res.status(404).json({ error: 'not_found' });
  const { date, account_id, contact_id, currency, fx_rate, amount, memo, payment_account_id } = req.body || {};
  const cid = req.user.company_id;
  const cur = currency || ex.currency;
  const rate = fx_rate ? Number(fx_rate) : rateFor(cid, cur);
  const amt = amount === undefined ? ex.amount : Number(amount);
  const base = r2(amt / rate);
  const accId = account_id || ex.account_id;
  const acc = db.prepare('SELECT id FROM accounts WHERE id = ? AND company_id = ?').get(accId, cid);
  if (!acc) return res.status(400).json({ error: 'invalid_account' });
  db.prepare('UPDATE expenses SET date=?, account_id=?, contact_id=?, currency=?, fx_rate=?, amount=?, base_amount=?, memo=?, payment_account_id=? WHERE id=?')
    .run(date || ex.date, accId, contact_id === undefined ? ex.contact_id : contact_id, cur, rate, amt, base,
      memo === undefined ? ex.memo : memo, payment_account_id === undefined ? ex.payment_account_id : payment_account_id, ex.id);
  // remove the old journal entry and re-post with the new values
  const oldEntry = db.prepare("SELECT * FROM journal_entries WHERE company_id = ? AND source='expense' AND source_id = ?").get(cid, ex.id);
  if (oldEntry) db.prepare('DELETE FROM journal_entries WHERE id = ?').run(oldEntry.id);
  const defaultCash = db.prepare("SELECT id FROM accounts WHERE company_id=? AND code LIKE '10%' ORDER BY code LIMIT 1").get(cid)?.id
    || db.prepare("SELECT id FROM accounts WHERE company_id=? AND code='2100'").get(cid)?.id;
  const payAcc = payment_account_id || ex.payment_account_id || defaultCash;
  createEntry(cid, date || ex.date, (memo === undefined ? ex.memo : memo) || 'Expense',
    oldEntry ? oldEntry.reference : 'EXP-' + ex.id, 'expense', ex.id, [
      { account_id: accId, debit: base, credit: 0 },
      { account_id: payAcc, debit: 0, credit: base },
    ]);
  res.json({ expense: db.prepare('SELECT * FROM expenses WHERE id = ?').get(ex.id) });
});

/* ============ Delete expense (removes the linked journal entry too) ============ */
router.delete('/expenses/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM expenses WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!ex) return res.status(404).json({ error: 'not_found' });
  db.prepare("DELETE FROM journal_entries WHERE company_id = ? AND source='expense' AND source_id = ?").run(req.user.company_id, ex.id);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(ex.id);
  res.json({ ok: true });
});

/* ============ Debts (receivables & payables per contact) ============ */
router.get('/debts', (req, res) => {
  const cid = req.user.company_id;
  const contacts = db.prepare("SELECT * FROM contacts WHERE company_id = ? AND kind IN ('customer','supplier') ORDER BY name").all(cid);
  const build = (kind) => {
    const list = [];
    for (const c of contacts) {
      if (c.kind !== kind) continue;
      const rows = db.prepare(`SELECT i.total, i.fx_rate, i.total_base,
          ROUND(COALESCE((SELECT SUM(p.base_amount) FROM payments p WHERE p.invoice_id = i.id),0),2) AS paid
        FROM invoices i WHERE i.company_id=? AND i.contact_id=? AND i.kind=? AND i.status!='draft'`)
        .all(cid, c.id, kind === 'customer' ? 'sale' : 'purchase');
      const billed = r2(rows.reduce((s, r) => s + r2(r.total_base || r.total / r.fx_rate), 0));
      const paid = r2(rows.reduce((s, r) => s + r.paid, 0));
      const outstanding = r2(billed - paid);
      if (outstanding > 0.005) {
        list.push({ contact_id: c.id, name: c.name, email: c.email, phone: c.phone, currency: c.currency, count: rows.length, billed, paid, outstanding });
      }
    }
    return list;
  };
  const ar = build('customer');
  const ap = build('supplier');
  res.json({
    ar,
    ap,
    totalAR: r2(ar.reduce((s, x) => s + x.outstanding, 0)),
    totalAP: r2(ap.reduce((s, x) => s + x.outstanding, 0)),
  });
});

/* ============ Customer / Supplier statement (report by contact name) ============ */
router.get('/statement', (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ? AND company_id = ?')
    .get(req.query.contact_id, req.user.company_id);
  if (!contact) return res.status(404).json({ error: 'not_found' });
  const kind = contact.kind === 'customer' ? 'sale' : 'purchase';
  let sql = `
    SELECT i.id, i.number, i.date, i.currency, i.fx_rate, i.total, i.total_base, i.status,
      ROUND(COALESCE((SELECT SUM(p.base_amount) FROM payments p WHERE p.invoice_id = i.id),0),2) AS paid_base
    FROM invoices i WHERE i.company_id = ? AND i.kind = ? AND i.contact_id = ? AND i.status != 'draft'`;
  const params = [req.user.company_id, kind, contact.id];
  if (req.query.from) { sql += ' AND i.date >= ?'; params.push(req.query.from); }
  if (req.query.to) { sql += ' AND i.date <= ?'; params.push(req.query.to); }
  sql += ' ORDER BY i.date ASC, i.id ASC';
  const rows = db.prepare(sql).all(...params).map(r => {
    const totalBase = r2(r.total_base || r.total / r.fx_rate);
    return { ...r, total_base: totalBase, outstanding: r2(totalBase - r.paid_base) };
  });
  const totals = {
    total: r2(rows.reduce((s, r) => s + r.total_base, 0)),
    paid: r2(rows.reduce((s, r) => s + r.paid_base, 0)),
    outstanding: r2(rows.reduce((s, r) => s + r.outstanding, 0)),
  };
  res.json({ contact, kind, invoices: rows, totals });
});

module.exports = router;
