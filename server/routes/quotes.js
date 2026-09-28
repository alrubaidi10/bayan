const express = require('express');
const { db, requireAuth, r2, rateFor } = require('../lib');

const router = express.Router();
router.use(requireAuth);

function qNumber(cid) {
  const row = db.prepare(`SELECT number FROM quotes WHERE company_id = ? ORDER BY number DESC LIMIT 1`).get(cid);
  let n = 0;
  if (row) { const m = row.number.match(/(\d+)$/); if (m) n = parseInt(m[1], 10); }
  return 'QT-' + String(n + 1).padStart(4, '0');
}

router.get('/quotes', (req, res) => {
  const { getBranchCtx } = require('../lib');
  const { bid } = getBranchCtx(req);
  const bSql = bid ? 'AND q.branch_id = ?' : '';
  const bP = bid ? [bid] : [];

  const rows = db.prepare(`
    SELECT q.*, c.name AS contact_name
    FROM quotes q LEFT JOIN contacts c ON c.id = q.contact_id
    WHERE q.company_id = ? ${bSql} ORDER BY q.date DESC, q.id DESC`).all(req.user.company_id, ...bP);
  res.json({ quotes: rows });
});

router.get('/quotes/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!q) return res.status(404).json({ error: 'not_found' });
  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(q.id);
  const contact = q.contact_id ? db.prepare('SELECT * FROM contacts WHERE id = ?').get(q.contact_id) : null;
  res.json({ quote: q, items, contact });
});

router.post('/quotes', (req, res) => {
  const { contact_id, date, valid_until, currency, fx_rate, tax_rate, memo, items } = req.body || {};
  const cid = req.user.company_id;

  const { getEffectiveBranchId } = require('../lib');
  const bid = getEffectiveBranchId(req);
  if (bid === null) return res.status(400).json({ error: 'no_branch_selected' });

  if (!date || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'missing_fields' });
  const cur = currency || 'USD';
  const rate = fx_rate ? Number(fx_rate) : rateFor(cid, cur);
  const taxPct = tax_rate === undefined ? (req.user.tax_enabled ? req.user.tax_rate : 0) : Number(tax_rate);
  let subtotalBase = 0;
  const rows = [];
  for (const it of items) {
    const qty = Number(it.qty) || 1;
    const lineCur = it.currency || cur;
    const lineFx = it.fx_rate ? Number(it.fx_rate) : rateFor(cid, lineCur);
    const price = Number(it.unit_price) || 0;   // line currency
    const amount = r2(qty * price);             // line currency
    const base = r2(amount / lineFx);           // base currency
    subtotalBase += base;
    rows.push({ product_id: it.product_id || null, description: it.description || '', qty, unit_price: price, amount, base_amount: base, currency: lineCur, fx_rate: lineFx });
  }
  subtotalBase = r2(subtotalBase);
  const taxBase = r2(subtotalBase * taxPct / 100);
  const totalBase = r2(subtotalBase + taxBase);
  const subtotal = r2(subtotalBase * rate);
  const taxAmount = r2(taxBase * rate);
  const total = r2(totalBase * rate);
  const id = db.prepare(`INSERT INTO quotes (company_id, branch_id, number, contact_id, date, valid_until, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(cid, bid, qNumber(cid), contact_id || null, date, valid_until || null, cur, rate, subtotal, taxAmount, total, subtotalBase, taxBase, totalBase, 'draft', memo || '')
    .lastInsertRowid;
  const ins = db.prepare('INSERT INTO quote_items (quote_id, product_id, description, qty, unit_price, amount, base_amount, currency, fx_rate) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const r of rows) ins.run(id, r.product_id, r.description, r.qty, r.unit_price, r.amount, r.base_amount, r.currency, r.fx_rate);
  res.json({ quote: db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) });
});

router.put('/quotes/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!q) return res.status(404).json({ error: 'not_found' });
  const { status } = req.body || {};
  if (!['draft', 'sent', 'accepted', 'converted'].includes(status)) return res.status(400).json({ error: 'invalid_status' });
  db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(status, q.id);
  res.json({ quote: db.prepare('SELECT * FROM quotes WHERE id = ?').get(q.id) });
});

/** Convert a quote into a draft sales invoice (customer can then post it). */
router.post('/quotes/:id/convert', (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!q) return res.status(404).json({ error: 'not_found' });
  if (q.status === 'converted') return res.status(400).json({ error: 'already_converted' });
  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(q.id);
  const invNo = (() => {
    const row = db.prepare(`SELECT number FROM invoices WHERE company_id = ? AND kind='sale' ORDER BY number DESC LIMIT 1`).get(req.user.company_id);
    let n = 0;
    if (row) { const m = row.number.match(/(\d+)$/); if (m) n = parseInt(m[1], 10); }
    return 'INV-' + String(n + 1).padStart(4, '0');
  })();
  const invId = db.prepare(`INSERT INTO invoices (company_id, branch_id, kind, number, contact_id, date, due_date, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.company_id, q.branch_id, 'sale', invNo, q.contact_id, q.date, q.valid_until, q.currency, q.fx_rate,
      q.subtotal, q.tax_amount, q.total, q.subtotal_base || r2(q.subtotal / q.fx_rate), q.tax_base || r2(q.tax_amount / q.fx_rate), q.total_base || r2(q.total / q.fx_rate),
      'draft', 'From quote ' + q.number + (q.memo ? ' — ' + q.memo : ''))
    .lastInsertRowid;
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, product_id, description, qty, unit_price, amount, base_amount, currency, fx_rate) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const it of items) ins.run(invId, it.product_id, it.description, it.qty, it.unit_price, it.amount, r2(it.amount / (it.fx_rate || q.fx_rate)), it.currency || q.currency, it.fx_rate || q.fx_rate);
  db.prepare("UPDATE quotes SET status='converted', converted_invoice_id=? WHERE id=?").run(invId, q.id);
  res.json({ quote: db.prepare('SELECT * FROM quotes WHERE id = ?').get(q.id), invoice: db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) });
});

router.delete('/quotes/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!q) return res.status(404).json({ error: 'not_found' });
  if (q.status !== 'draft') return res.status(400).json({ error: 'posted_only_draft' });
  db.prepare('DELETE FROM quotes WHERE id = ?').run(q.id);
  res.json({ ok: true });
});

module.exports = router;
