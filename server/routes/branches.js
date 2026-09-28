const express = require('express');
const { db, requireAuth } = require('../lib');
const { triggerAutoSync } = require('../firebase');
const router = express.Router();
router.use(requireAuth);

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.is_superadmin) return res.status(403).json({ error: 'forbidden' });
  next();
}

// GET /api/branches — list all branches for this company
router.get('/', (req, res) => {
  const branches = db.prepare('SELECT * FROM branches WHERE company_id = ? ORDER BY id').all(req.user.company_id);
  // For each branch, count users
  const result = branches.map(b => ({
    ...b,
    user_count: db.prepare('SELECT COUNT(*) n FROM users WHERE company_id = ? AND branch_id = ?').get(req.user.company_id, b.id).n
  }));
  res.json({ branches: result });
});

// POST /api/branches — create branch
router.post('/', requireAdmin, (req, res) => {
  const { name, code, address, phone } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing_fields' });
  const info = db.prepare('INSERT INTO branches (company_id, name, code, address, phone) VALUES (?,?,?,?,?)')
    .run(req.user.company_id, name.trim(), (code || '').trim().toUpperCase(), address || '', phone || '');
  triggerAutoSync(req.user.company_id);
  res.json({ branch: db.prepare('SELECT * FROM branches WHERE id = ?').get(info.lastInsertRowid) });
});

// PUT /api/branches/:id — update branch
router.put('/:id', requireAdmin, (req, res) => {
  const b = db.prepare('SELECT * FROM branches WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  const { name, code, address, phone, is_active } = req.body || {};
  db.prepare('UPDATE branches SET name=?, code=?, address=?, phone=?, is_active=? WHERE id=?')
    .run(name ?? b.name, code !== undefined ? code.trim().toUpperCase() : b.code, address ?? b.address, phone ?? b.phone,
      is_active === undefined ? b.is_active : (is_active ? 1 : 0), b.id);
  triggerAutoSync(req.user.company_id);
  res.json({ branch: db.prepare('SELECT * FROM branches WHERE id = ?').get(b.id) });
});

// DELETE /api/branches/:id — delete branch (only if empty)
router.delete('/:id', requireAdmin, (req, res) => {
  const b = db.prepare('SELECT * FROM branches WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  // Cannot delete the last branch
  const count = db.prepare('SELECT COUNT(*) n FROM branches WHERE company_id = ?').get(req.user.company_id).n;
  if (count <= 1) return res.status(400).json({ error: 'last_branch' });
  // Check if branch has any data
  const hasData = [
    db.prepare('SELECT COUNT(*) n FROM invoices WHERE branch_id = ?').get(b.id).n,
    db.prepare('SELECT COUNT(*) n FROM contacts WHERE branch_id = ?').get(b.id).n,
    db.prepare('SELECT COUNT(*) n FROM products WHERE branch_id = ?').get(b.id).n,
    db.prepare('SELECT COUNT(*) n FROM users WHERE branch_id = ?').get(b.id).n,
  ].some(n => n > 0);
  if (hasData) return res.status(400).json({ error: 'branch_has_data' });
  db.prepare('DELETE FROM branches WHERE id = ?').run(b.id);
  triggerAutoSync(req.user.company_id);
  res.json({ ok: true });
});

// GET /api/branches/:id/summary — branch stats
router.get('/:id/summary', (req, res) => {
  const b = db.prepare('SELECT * FROM branches WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  const cid = req.user.company_id;
  const bid = b.id;
  const invoiceCount = db.prepare('SELECT COUNT(*) n FROM invoices WHERE company_id=? AND branch_id=? AND kind=\'sale\' AND status!=\'draft\'').get(cid, bid).n;
  const revenue = db.prepare('SELECT ROUND(COALESCE(SUM(COALESCE(subtotal_base, subtotal/fx_rate)),0),2) v FROM invoices WHERE company_id=? AND branch_id=? AND kind=\'sale\' AND status!=\'draft\'').get(cid, bid).v;
  const contactCount = db.prepare('SELECT COUNT(*) n FROM contacts WHERE company_id=? AND branch_id=?').get(cid, bid).n;
  const productCount = db.prepare('SELECT COUNT(*) n FROM products WHERE company_id=? AND branch_id=?').get(cid, bid).n;
  const userCount = db.prepare('SELECT COUNT(*) n FROM users WHERE company_id=? AND branch_id=?').get(cid, bid).n;
  const invValue = db.prepare('SELECT ROUND(COALESCE(SUM(stock*cost),0),2) v FROM products WHERE company_id=? AND branch_id=?').get(cid, bid).v;
  res.json({ branch: b, stats: { invoiceCount, revenue, contactCount, productCount, userCount, invValue } });
});

module.exports = router;
