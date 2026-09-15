const express = require('express');
const { db, requireAuth, hashPassword, todayISO, daysLeft } = require('../lib');
const { createCompany } = require('../seed');

const router = express.Router();
router.use(requireAuth);

function requireSuperAdmin(req, res, next) {
  if (!req.user.is_superadmin) return res.status(403).json({ error: 'forbidden' });
  next();
}
router.use(requireSuperAdmin);

/* ============ Overview / stats ============ */
router.get('/stats', (req, res) => {
  const n = (sql, ...p) => db.prepare(sql).get(...p).n;
  const today = todayISO();
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  res.json({
    total: n('SELECT COUNT(*) n FROM companies'),
    active: n("SELECT COUNT(*) n FROM companies WHERE status = 'active'"),
    trial: n("SELECT COUNT(*) n FROM companies WHERE status = 'trial'"),
    expiring30: n("SELECT COUNT(*) n FROM companies WHERE status IN ('active','trial') AND subscription_end IS NOT NULL AND subscription_end <= ? AND subscription_end >= ?", in30, today),
    locked: n("SELECT COUNT(*) n FROM companies WHERE status IN ('suspended','expired')"),
    users: n('SELECT COUNT(*) n FROM users'),
  });
});

/* ============ Create a customer company + its first admin user (admin gives credentials) ============ */
router.post('/companies', (req, res) => {
  const { name, base_currency, user_name, user_email, password, plan, add_days } = req.body || {};
  if (!name || !user_name || !user_email || !password) return res.status(400).json({ error: 'missing_fields' });
  if (String(password).length < 6) return res.status(400).json({ error: 'password_short' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(user_email)) return res.status(400).json({ error: 'email_taken' });

  const company = createCompany({ name, base_currency: ['USD', 'YER', 'SAR', 'EUR'].includes(base_currency) ? base_currency : 'USD' });
  const pl = plan || 'trial';
  const start = todayISO();
  const end = add_days ? new Date(Date.now() + Number(add_days) * 864e5).toISOString().slice(0, 10) : null;
  db.prepare("UPDATE companies SET plan=?, status=?, subscription_start=?, subscription_end=? WHERE id=?")
    .run(pl, pl === 'trial' ? 'trial' : 'active', start, end, company.id);

  const info = db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)')
    .run(company.id, user_name, user_email, hashPassword(password), 'admin');
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid);

  db.prepare('INSERT INTO notifications (company_id, subject, message, sender_name) VALUES (?,?,?,?)').run(company.id,
    'Welcome to Mizan ERP',
    'Your account was created by the platform admin. You can change your password anytime from Settings.',
    'Mizan Admin');

  res.json({ company: db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id), user });
});

/* ============ Users of a company ============ */
router.get('/companies/:id/users', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'not_found' });
  const users = db.prepare('SELECT id, name, email, role, is_superadmin FROM users WHERE company_id = ? ORDER BY id')
    .all(company.id);
  res.json({ users });
});

/* ============ Reset a customer's password (admin) ============ */
router.put('/users/:id/password', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const { password } = req.body || {};
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'password_short' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), u.id);
  res.json({ ok: true });
});

/* ============ Companies list ============ */
router.get('/companies', (req, res) => {
  const { q, status } = req.query;
  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS user_count,
      (SELECT email FROM users u WHERE u.company_id = c.id ORDER BY u.id LIMIT 1) AS owner_email,
      (SELECT name FROM users u WHERE u.company_id = c.id ORDER BY u.id LIMIT 1) AS owner_name
    FROM companies c WHERE 1=1`;
  const params = [];
  if (status && status !== 'all') { sql += ' AND c.status = ?'; params.push(status); }
  if (q) { sql += ' AND (c.name LIKE ? OR (SELECT email FROM users u WHERE u.company_id=c.id ORDER BY u.id LIMIT 1) LIKE ?)'; params.push('%' + q + '%', '%' + q + '%'); }
  sql += ' ORDER BY c.id DESC';
  const companies = db.prepare(sql).all(...params)
    .map(c => ({ ...c, days_left: daysLeft(c.subscription_end) }));
  res.json({ companies });
});

/* ============ Create a user for a customer company ============ */
router.post('/companies/:id/users', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'not_found' });
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'missing_fields' });
  if (String(password).length < 6) return res.status(400).json({ error: 'password_short' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(400).json({ error: 'email_taken' });
  const info = db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)')
    .run(company.id, name, email, hashPassword(password), role === 'staff' ? 'staff' : 'admin');
  res.json({ user: db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid) });
});

/* ============ Subscription management (days / months / years / exact date) ============ */
router.put('/companies/:id/subscription', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'not_found' });
  const { plan, subscription_end, status, add_days, add_months, add_years } = req.body || {};
  let end = subscription_end || company.subscription_end;
  const n = Number(add_days) || Number(add_months) || Number(add_years) || 0;
  if (n > 0) {
    const base = new Date();
    let y = base.getFullYear(), m = base.getMonth(), d = base.getDate();
    if (add_years) y += Number(add_years);
    if (add_months) m += Number(add_months);
    if (add_days) d += Number(add_days);
    end = new Date(y, m, d).toISOString().slice(0, 10);
  }
  const st = status || company.status;
  const pl = plan || company.plan;
  db.prepare('UPDATE companies SET plan=?, subscription_end=?, status=?, subscription_start=COALESCE(subscription_start, ?) WHERE id=?')
    .run(pl, end || null, st, todayISO(), company.id);
  res.json({ company: db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id) });
});

router.put('/companies/:id/status', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'not_found' });
  const { status } = req.body || {};
  if (!['active', 'trial', 'suspended', 'expired'].includes(status)) return res.status(400).json({ error: 'invalid_status' });
  db.prepare('UPDATE companies SET status = ? WHERE id = ?').run(status, company.id);
  res.json({ company: db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id) });
});

/* ============ Send subscription message to a customer ============ */
router.post('/companies/:id/notify', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'not_found' });
  const { subject, message } = req.body || {};
  if (!subject || !message) return res.status(400).json({ error: 'missing_fields' });
  const info = db.prepare('INSERT INTO notifications (company_id, subject, message, sender_name) VALUES (?,?,?,?)')
    .run(company.id, subject, message, req.user.user_name);
  res.json({ notification: db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid) });
});

/* ============ Outbox (sent messages log) ============ */
router.get('/notifications', (req, res) => {
  const rows = db.prepare(`
    SELECT n.*, c.name AS company_name
    FROM notifications n JOIN companies c ON c.id = n.company_id
    ORDER BY n.id DESC LIMIT 100`).all();
  res.json({ notifications: rows });
});

module.exports = router;
