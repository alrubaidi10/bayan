const express = require('express');
const { db, requireAuth, todayISO } = require('../lib');

const router = express.Router();
router.use(requireAuth);

const APP_MARK = 'bayan-erp-backup';

/* ---------- Collect every piece of the company's data ---------- */
function exportCompany(cid) {
  const q = (sql, ...p) => db.prepare(sql).all(...p);
  const q1 = (sql, ...p) => db.prepare(sql).get(...p);
  return {
    app: APP_MARK,
    version: 1,
    exported_at: new Date().toISOString(),
    company: q1('SELECT name, base_currency, tax_enabled, tax_rate FROM companies WHERE id=?', cid),
    currencies: q('SELECT code, symbol, name, rate FROM currencies WHERE company_id=? ORDER BY code', cid),
    accounts: q('SELECT id, code, name, name_ar, type, is_active FROM accounts WHERE company_id=? ORDER BY id', cid),
    contacts: q('SELECT id, kind, name, email, phone, address, tax_no, currency FROM contacts WHERE company_id=? ORDER BY id', cid),
    products: q('SELECT id, name, name_ar, category, sku, barcode, unit, cost, price, stock, reorder_level, is_active FROM products WHERE company_id=? ORDER BY id', cid),
    journal_entries: q('SELECT id, date, memo, reference, source, source_id, posted FROM journal_entries WHERE company_id=? ORDER BY id', cid),
    journal_lines: q(`SELECT jl.entry_id, jl.account_id, jl.debit, jl.credit
      FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
      WHERE je.company_id=? ORDER BY jl.id`, cid),
    invoices: q(`SELECT id, kind, number, contact_id, date, due_date, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo, posted_at
      FROM invoices WHERE company_id=? ORDER BY id`, cid),
    invoice_items: q(`SELECT ii.invoice_id, ii.product_id, ii.description, ii.qty, ii.unit_price, ii.amount, ii.base_amount, ii.currency, ii.fx_rate
      FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.company_id=? ORDER BY ii.id`, cid),
    payments: q(`SELECT p.invoice_id, p.date, p.amount, p.base_amount, p.account_id, p.memo
      FROM payments p JOIN invoices i ON i.id = p.invoice_id
      WHERE i.company_id=? ORDER BY p.id`, cid),
    expenses: q('SELECT id, date, account_id, contact_id, currency, fx_rate, amount, base_amount, tax_amount, memo, payment_account_id FROM expenses WHERE company_id=? ORDER BY id', cid),
    quotes: q('SELECT id, number, contact_id, date, valid_until, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo, converted_invoice_id FROM quotes WHERE company_id=? ORDER BY id', cid),
    quote_items: q(`SELECT qi.quote_id, qi.product_id, qi.description, qi.qty, qi.unit_price, qi.amount, qi.currency, qi.fx_rate
      FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id
      WHERE q.company_id=? ORDER BY qi.id`, cid),
    stock_moves: q('SELECT product_id, date, qty, ref_type, ref_id, unit_cost FROM stock_moves WHERE company_id=? ORDER BY id', cid),
    notifications: q('SELECT subject, message, sender_name, read, created_at FROM notifications WHERE company_id=? ORDER BY id', cid),
  };
}

/* ================= Export ================= */
router.get('/export', (req, res) => {
  const data = exportCompany(req.user.company_id);
  const company = db.prepare('SELECT name FROM companies WHERE id=?').get(req.user.company_id);
  const slug = String(company.name || 'company').replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 40) || 'company';
  const fname = `bayan-backup-${slug}-${todayISO()}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.json(data);
});

/* ================= Import (restore, replaces current data) ================= */
router.post('/import', (req, res) => {
  const payload = req.body || {};
  if (payload.app !== APP_MARK || !Array.isArray(payload.accounts)) {
    return res.status(400).json({ error: 'invalid_backup' });
  }
  const cid = req.user.company_id;
  const num = (x) => Number(x) || 0;

  try {
    const restore = db.transaction(() => {
      /* wipe existing company data in dependency order */
      db.prepare('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id=?)').run(cid);
      db.prepare('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id=?)').run(cid);
      db.prepare('DELETE FROM invoices WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM quote_items WHERE quote_id IN (SELECT id FROM quotes WHERE company_id=?)').run(cid);
      db.prepare('DELETE FROM quotes WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM stock_moves WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM expenses WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE company_id=?)').run(cid);
      db.prepare('DELETE FROM journal_entries WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM notifications WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM products WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM contacts WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM accounts WHERE company_id=?').run(cid);
      db.prepare('DELETE FROM currencies WHERE company_id=?').run(cid);

      /* company settings */
      const c = payload.company || {};
      db.prepare('UPDATE companies SET name=?, base_currency=?, tax_enabled=?, tax_rate=? WHERE id=?')
        .run(c.name || 'My Company', c.base_currency || 'USD', c.tax_enabled ? 1 : 0, num(c.tax_rate), cid);

      /* currencies */
      const insCur = db.prepare('INSERT INTO currencies (company_id, code, symbol, name, rate) VALUES (?,?,?,?,?)');
      for (const cur of payload.currencies || []) {
        if (cur && cur.code) insCur.run(cid, cur.code, cur.symbol || '', cur.name || '', num(cur.rate) || 1);
      }

      /* accounts (remap ids) */
      const accMap = {};
      const insAcc = db.prepare('INSERT INTO accounts (company_id, code, name, name_ar, type, is_active) VALUES (?,?,?,?,?,?)');
      for (const a of payload.accounts || []) {
        const info = insAcc.run(cid, String(a.code), a.name || '', a.name_ar || '', a.type || 'expense', a.is_active === undefined || a.is_active ? 1 : 0);
        accMap[a.id] = info.lastInsertRowid;
      }
      /* contacts */
      const conMap = {};
      const insCon = db.prepare('INSERT INTO contacts (company_id, kind, name, email, phone, address, tax_no, currency) VALUES (?,?,?,?,?,?,?,?)');
      for (const ct of payload.contacts || []) {
        const info = insCon.run(cid, ct.kind === 'supplier' ? 'supplier' : 'customer', ct.name || '', ct.email || '', ct.phone || '', ct.address || '', ct.tax_no || '', ct.currency || '');
        conMap[ct.id] = info.lastInsertRowid;
      }
      /* products */
      const prodMap = {};
      const insProd = db.prepare('INSERT INTO products (company_id, name, name_ar, category, sku, barcode, unit, cost, price, stock, reorder_level, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      for (const p of payload.products || []) {
        const info = insProd.run(cid, p.name || '', p.name_ar || '', p.category || '', p.sku || '', p.barcode || '', p.unit || 'pcs', num(p.cost), num(p.price), num(p.stock), num(p.reorder_level), p.is_active === undefined || p.is_active ? 1 : 0);
        prodMap[p.id] = info.lastInsertRowid;
      }
      /* journal entries */
      const entryMap = {};
      const insEntry = db.prepare('INSERT INTO journal_entries (company_id, date, memo, reference, source, source_id, posted) VALUES (?,?,?,?,?,?,?)');
      const insLine = db.prepare('INSERT INTO journal_lines (entry_id, account_id, debit, credit) VALUES (?,?,?,?)');
      for (const e of payload.journal_entries || []) {
        const info = insEntry.run(cid, e.date || todayISO(), e.memo || '', e.reference || '', e.source || 'manual', num(e.source_id), e.posted === undefined ? 1 : (e.posted ? 1 : 0));
        entryMap[e.id] = info.lastInsertRowid;
      }
      for (const l of payload.journal_lines || []) {
        const eid = entryMap[l.entry_id];
        const aid = accMap[l.account_id];
        if (eid && aid) insLine.run(eid, aid, num(l.debit), num(l.credit));
      }
      /* invoices */
      const invMap = {};
      const insInv = db.prepare('INSERT INTO invoices (company_id, kind, number, contact_id, date, due_date, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo, posted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      for (const i of payload.invoices || []) {
        const info = insInv.run(cid, i.kind === 'purchase' ? 'purchase' : 'sale', i.number || '', conMap[i.contact_id] || null,
          i.date || todayISO(), i.due_date || null, i.currency || 'USD', num(i.fx_rate) || 1, num(i.subtotal), num(i.tax_amount), num(i.total),
          num(i.subtotal_base) || 0, num(i.tax_base) || 0, num(i.total_base) || 0,
          i.status || 'draft', i.memo || '', i.posted_at || null);
        invMap[i.id] = info.lastInsertRowid;
      }
      const insItem = db.prepare('INSERT INTO invoice_items (invoice_id, product_id, description, qty, unit_price, amount, base_amount, currency, fx_rate) VALUES (?,?,?,?,?,?,?,?,?)');
      for (const it of payload.invoice_items || []) {
        const iid = invMap[it.invoice_id];
        if (iid) insItem.run(iid, prodMap[it.product_id] || null, it.description || '', num(it.qty) || 1, num(it.unit_price), num(it.amount), num(it.base_amount), it.currency || '', num(it.fx_rate) || 1);
      }
      /* payments */
      const insPay = db.prepare('INSERT INTO payments (company_id, invoice_id, date, amount, base_amount, account_id, memo) VALUES (?,?,?,?,?,?,?)');
      for (const pay of payload.payments || []) {
        const iid = invMap[pay.invoice_id];
        if (iid) insPay.run(cid, iid, pay.date || todayISO(), num(pay.amount), num(pay.base_amount), accMap[pay.account_id] || null, pay.memo || '');
      }
      /* expenses */
      const expMap = {};
      const insExp = db.prepare('INSERT INTO expenses (company_id, date, account_id, contact_id, currency, fx_rate, amount, base_amount, tax_amount, memo, payment_account_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      for (const ex of payload.expenses || []) {
        const info = insExp.run(cid, ex.date || todayISO(), accMap[ex.account_id] || null, conMap[ex.contact_id] || null,
          ex.currency || 'USD', num(ex.fx_rate) || 1, num(ex.amount), num(ex.base_amount), num(ex.tax_amount), ex.memo || '', accMap[ex.payment_account_id] || null);
        expMap[ex.id] = info.lastInsertRowid;
      }
      /* quotes */
      const quoteMap = {};
      const insQuote = db.prepare('INSERT INTO quotes (company_id, number, contact_id, date, valid_until, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo, converted_invoice_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      for (const q of payload.quotes || []) {
        const info = insQuote.run(cid, q.number || '', conMap[q.contact_id] || null, q.date || todayISO(), q.valid_until || null,
          q.currency || 'USD', num(q.fx_rate) || 1, num(q.subtotal), num(q.tax_amount), num(q.total),
          num(q.subtotal_base) || 0, num(q.tax_base) || 0, num(q.total_base) || 0,
          q.status || 'draft', q.memo || '',
          q.converted_invoice_id ? (invMap[q.converted_invoice_id] || null) : null);
        quoteMap[q.id] = info.lastInsertRowid;
      }
      const insQItem = db.prepare('INSERT INTO quote_items (quote_id, product_id, description, qty, unit_price, amount, currency, fx_rate) VALUES (?,?,?,?,?,?,?,?)');
      for (const qi of payload.quote_items || []) {
        const qid = quoteMap[qi.quote_id];
        if (qid) insQItem.run(qid, prodMap[qi.product_id] || null, qi.description || '', num(qi.qty) || 1, num(qi.unit_price), num(qi.amount), qi.currency || '', num(qi.fx_rate) || 1);
      }
      /* stock moves (ref_id -> remapped invoice id) */
      const insMove = db.prepare('INSERT INTO stock_moves (company_id, product_id, date, qty, ref_type, ref_id, unit_cost) VALUES (?,?,?,?,?,?,?)');
      for (const mv of payload.stock_moves || []) {
        const pid = prodMap[mv.product_id];
        if (!pid) continue;
        const refId = (mv.ref_type === 'invoice' || mv.ref_type === 'bill') ? (invMap[mv.ref_id] || 0) : num(mv.ref_id);
        insMove.run(cid, pid, mv.date || todayISO(), num(mv.qty), mv.ref_type || '', refId, num(mv.unit_cost));
      }
      /* notifications */
      const insNotif = db.prepare('INSERT INTO notifications (company_id, subject, message, sender_name, read, created_at) VALUES (?,?,?,?,?,?)');
      for (const n of payload.notifications || []) {
        insNotif.run(cid, n.subject || '', n.message || '', n.sender_name || '', n.read ? 1 : 0, n.created_at || new Date().toISOString());
      }
    });
    restore();

    res.json({
      ok: true,
      counts: {
        accounts: (payload.accounts || []).length,
        contacts: (payload.contacts || []).length,
        products: (payload.products || []).length,
        invoices: (payload.invoices || []).length,
        entries: (payload.journal_entries || []).length,
        quotes: (payload.quotes || []).length,
      },
    });
  } catch (e) {
    console.error('Backup import failed:', e.message);
    res.status(400).json({ error: 'invalid_backup' });
  }
});

module.exports = router;
