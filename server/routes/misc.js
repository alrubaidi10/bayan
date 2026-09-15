const express = require('express');
const { db, requireAuth, r2, productById } = require('../lib');

const router = express.Router();
router.use(requireAuth);

/* ============ Contacts ============ */
router.get('/contacts', (req, res) => {
  const kind = req.query.kind;
  const sql = kind ? 'SELECT * FROM contacts WHERE company_id = ? AND kind = ? ORDER BY name' : 'SELECT * FROM contacts WHERE company_id = ? ORDER BY kind, name';
  const params = kind ? [req.user.company_id, kind] : [req.user.company_id];
  const contacts = db.prepare(sql).all(...params).map(c => {
    const bal = db.prepare(`
      SELECT ROUND(COALESCE(SUM(i.total / i.fx_rate - COALESCE((SELECT SUM(p.base_amount) FROM payments p WHERE p.invoice_id = i.id),0)),0),2) v
      FROM invoices i WHERE i.company_id = ? AND i.contact_id = ? AND i.kind = ? AND i.status != 'draft'`)
      .get(req.user.company_id, c.id, c.kind === 'customer' ? 'sale' : 'purchase').v;
    return { ...c, balance: bal };
  });
  res.json({ contacts });
});

router.post('/contacts', (req, res) => {
  const { kind, name, email, phone, address, tax_no, currency } = req.body || {};
  if (!kind || !name) return res.status(400).json({ error: 'missing_fields' });
  const info = db.prepare('INSERT INTO contacts (company_id, kind, name, email, phone, address, tax_no, currency) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.user.company_id, kind, name, email || '', phone || '', address || '', tax_no || '', currency || '');
  res.json({ contact: db.prepare('SELECT * FROM contacts WHERE id = ?').get(info.lastInsertRowid) });
});

router.put('/contacts/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM contacts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  const { name, email, phone, address, tax_no, currency } = req.body || {};
  db.prepare('UPDATE contacts SET name=?, email=?, phone=?, address=?, tax_no=?, currency=? WHERE id=?')
    .run(name ?? c.name, email ?? c.email, phone ?? c.phone, address ?? c.address, tax_no ?? c.tax_no,
      currency === undefined ? c.currency : currency, c.id);
  res.json({ contact: db.prepare('SELECT * FROM contacts WHERE id = ?').get(c.id) });
});

/* ============ Products / Inventory ============ */
router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE company_id = ? ORDER BY name').all(req.user.company_id)
    .map(p => ({ ...p, low: p.stock <= p.reorder_level, value: r2(p.stock * p.cost) }));
  const categories = [...new Set(rows.map(p => p.category).filter(Boolean))].sort();
  res.json({ products: rows, categories });
});

router.post('/products', (req, res) => {
  const { name, name_ar, category, sku, barcode, unit, cost, price, stock, reorder_level } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing_fields' });
  const info = db.prepare('INSERT INTO products (company_id, name, name_ar, category, sku, barcode, unit, cost, price, stock, reorder_level) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.user.company_id, name, name_ar || '', category || '', sku || '', barcode || '', unit || 'pcs', Number(cost) || 0, Number(price) || 0, Number(stock) || 0, Number(reorder_level) || 0);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) });
});

router.put('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const { name, name_ar, category, sku, barcode, unit, price, reorder_level, is_active } = req.body || {};
  db.prepare('UPDATE products SET name=?, name_ar=?, category=?, sku=?, barcode=?, unit=?, price=?, reorder_level=?, is_active=? WHERE id=?')
    .run(name ?? p.name, name_ar ?? p.name_ar, category === undefined ? p.category : category,
      sku ?? p.sku, barcode === undefined ? p.barcode : barcode, unit ?? p.unit,
      price === undefined ? p.price : Number(price), reorder_level === undefined ? p.reorder_level : Number(reorder_level),
      is_active === undefined ? p.is_active : (is_active ? 1 : 0), p.id);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(p.id) });
});

router.get('/stock-moves/:id', (req, res) => {
  const p = productById(req.params.id, req.user.company_id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const moves = db.prepare('SELECT * FROM stock_moves WHERE product_id = ? ORDER BY date DESC, id DESC').all(p.id);
  res.json({ product: p, moves });
});

/* ============ Settings & Currencies ============ */
router.get('/settings', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  const currencies = db.prepare('SELECT * FROM currencies WHERE company_id = ? ORDER BY code').all(req.user.company_id);
  const accounts = db.prepare('SELECT id, code, name FROM accounts WHERE company_id = ? ORDER BY code').all(req.user.company_id);
  res.json({ company, currencies, accounts });
});

router.put('/settings', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  const { name, base_currency, tax_enabled, tax_rate } = req.body || {};
  if (base_currency && base_currency !== company.base_currency) {
    const oldBase = db.prepare('SELECT rate FROM currencies WHERE company_id=? AND code=?').get(req.user.company_id, company.base_currency);
    const newBase = db.prepare('SELECT rate FROM currencies WHERE company_id=? AND code=?').get(req.user.company_id, base_currency);
    if (!newBase) return res.status(400).json({ error: 'bad_currency' });
    const factor = oldBase.rate / newBase.rate; // old rate units of X per old base -> new rate per new base
    db.prepare('UPDATE currencies SET rate = ROUND(rate * ?, 4) WHERE company_id = ?').run(factor, req.user.company_id);
  }
  db.prepare('UPDATE companies SET name=?, base_currency=?, tax_enabled=?, tax_rate=? WHERE id=?')
    .run(name ?? company.name, base_currency ?? company.base_currency,
      tax_enabled === undefined ? company.tax_enabled : (tax_enabled ? 1 : 0),
      tax_rate === undefined ? company.tax_rate : Number(tax_rate), company.id);
  const c2 = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.company_id);
  const currencies = db.prepare('SELECT * FROM currencies WHERE company_id = ? ORDER BY code').all(req.user.company_id);
  res.json({ company: c2, currencies });
});

router.put('/currencies/:code', (req, res) => {
  const c = db.prepare('SELECT * FROM currencies WHERE company_id = ? AND code = ?').get(req.user.company_id, req.params.code);
  if (!c) return res.status(404).json({ error: 'not_found' });
  const { rate, symbol, name } = req.body || {};
  db.prepare('UPDATE currencies SET rate=?, symbol=?, name=? WHERE company_id=? AND code=?')
    .run(rate === undefined ? c.rate : Number(rate), symbol ?? c.symbol, name ?? c.name, req.user.company_id, c.code);
  res.json({ currency: db.prepare('SELECT * FROM currencies WHERE company_id = ? AND code = ?').get(req.user.company_id, c.code) });
});

/* ============ Notifications (messages sent by the platform admin) ============ */
router.get('/notifications', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE company_id = ? ORDER BY id DESC LIMIT 50')
    .all(req.user.company_id);
  const unread = rows.filter(r => !r.read).length;
  res.json({ notifications: rows, unread });
});

router.post('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE company_id = ? AND read = 0').run(req.user.company_id);
  res.json({ ok: true });
});

module.exports = router;
