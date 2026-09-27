const express = require('express');
const { db, requireAuth, hashPassword } = require('../lib');

const router = express.Router();
router.use(requireAuth);

/* Only company admin can manage users */
function requireCompanyAdmin(req, res, next) {
  if (req.user.role !== 'admin' && !req.user.is_superadmin) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

/* GET /api/users — list all users in this company */
router.get('/', requireCompanyAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, name, email, role, created_at FROM users WHERE company_id = ? ORDER BY role, name'
  ).all(req.user.company_id);
  res.json({ users });
});

/* POST /api/users — create a new user in this company */
router.post('/', requireCompanyAdmin, (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'missing_fields' });
  if (String(password).length < 6) return res.status(400).json({ error: 'password_short' });

  const VALID_ROLES = ['admin', 'manager', 'accountant', 'staff', 'cashier'];
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'invalid_role' });

  const taken = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (taken) return res.status(400).json({ error: 'email_taken' });

  const info = db.prepare(
    'INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)'
  ).run(req.user.company_id, name.trim(), email.trim().toLowerCase(), hashPassword(password), role);

  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ user });
});

/* PUT /api/users/:id — update user (name, email, role, password) */
router.put('/:id', requireCompanyAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!user) return res.status(404).json({ error: 'not_found' });

  // Cannot change superadmin role
  if (user.is_superadmin) return res.status(403).json({ error: 'forbidden' });

  const { name, email, role, password } = req.body || {};
  const VALID_ROLES = ['admin', 'manager', 'accountant', 'staff', 'cashier'];
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'invalid_role' });

  // Cannot demote the last admin
  if (role && role !== 'admin' && user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) n FROM users WHERE company_id = ? AND role = 'admin' AND id != ?").get(req.user.company_id, user.id).n;
    if (adminCount === 0) return res.status(400).json({ error: 'last_admin' });
  }

  if (email && email !== user.email) {
    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, user.id);
    if (taken) return res.status(400).json({ error: 'email_taken' });
  }

  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: 'password_short' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
  }

  db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(
    name ?? user.name,
    email ?? user.email,
    role ?? user.role,
    user.id
  );

  res.json({ user: db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(user.id) });
});

/* DELETE /api/users/:id — remove user */
router.delete('/:id', requireCompanyAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (user.is_superadmin) return res.status(403).json({ error: 'forbidden' });

  // Cannot delete yourself
  if (user.id === req.user.user_id) return res.status(400).json({ error: 'cannot_delete_self' });

  // Cannot delete the last admin
  if (user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) n FROM users WHERE company_id = ? AND role = 'admin' AND id != ?").get(req.user.company_id, user.id).n;
    if (adminCount === 0) return res.status(400).json({ error: 'last_admin' });
  }

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  res.json({ ok: true });
});

module.exports = router;
