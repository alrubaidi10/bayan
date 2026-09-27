const express = require('express');
const { db, hashPassword, verifyPassword, newToken, requireAuth, daysLeft, todayISO } = require('../lib');
const { createCompany, seedDemo, ensureDemoAccount } = require('../seed');

const router = express.Router();

function checkCompanyStatus(res, company, user) {
  if (!company) return res.status(401).json({ error: 'bad_credentials' });
  if (user && user.is_superadmin) return null; // platform admin is always allowed
  if (company.status === 'suspended') return res.status(403).json({ error: 'account_suspended' });
  const today = todayISO();
  if (company.subscription_end && company.subscription_end < today) {
    db.prepare("UPDATE companies SET status = 'expired' WHERE id = ?").run(company.id);
    return res.status(403).json({ error: 'account_expired' });
  }
  return null;
}
function issueSession(user, res) {
  const token = newToken();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)')
    .run(token, user.id, new Date(Date.now() + 3650 * 864e5).toISOString());
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || 'admin', company_id: user.company_id, is_superadmin: user.is_superadmin } });
}

/* Public self-registration, Google sign-in and the demo button were removed from the UI.
 * Accounts are created ONLY by the platform admin (admin panel / admin API). */
router.post('/register', (req, res) => res.status(403).json({ error: 'registration_closed' }));
router.post('/google', (req, res) => res.status(403).json({ error: 'registration_closed' }));

/* Login with email + password (accounts are created by the platform admin) */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'bad_credentials' });
  }
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id);
  const blocked = checkCompanyStatus(res, company, user);
  if (blocked) return blocked;
  issueSession(user, res);
});

/* Demo login endpoint */
router.post('/demo', (req, res) => {
  const { user, company } = ensureDemoAccount();
  issueSession(user, res);
});

router.post('/logout', requireAuth, (req, res) => {
  const h = req.headers.authorization || '';
  db.prepare('DELETE FROM sessions WHERE token = ?').run(h.slice(7));
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE company_id = ? AND read = 0')
    .get(req.user.company_id).n;
  res.json({
    user: {
      id: req.user.user_id,
      name: req.user.user_name,
      email: req.user.email,
      role: user ? user.role : 'admin',
      is_superadmin: !!req.user.is_superadmin,
    },
    company: {
      id: req.user.company_id, name: req.user.company_name,
      base_currency: req.user.base_currency,
      tax_enabled: !!req.user.tax_enabled, tax_rate: req.user.tax_rate,
      plan: req.user.plan, status: req.user.status,
      subscription_end: req.user.subscription_end,
      days_left: daysLeft(req.user.subscription_end),
    },
    unread_notifications: unread,
  });
});


/** Customer self-service: change own name / login email (username) / password. */
router.put('/account', requireAuth, (req, res) => {
  const { name, email, current_password, new_password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);
  let newEmail = user.email;
  if (email && email !== user.email) {
    const taken = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (taken) return res.status(400).json({ error: 'email_taken' });
    newEmail = email;
  }
  // changing email or password requires the current password
  if (new_password || (email && email !== user.email)) {
    if (!current_password || !verifyPassword(String(current_password), user.password_hash)) {
      return res.status(400).json({ error: 'wrong_password' });
    }
  }
  if (new_password) {
    if (String(new_password).length < 6) return res.status(400).json({ error: 'password_short' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), user.id);
  }
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name || user.name, newEmail, user.id);
  res.json({ user: db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(user.id) });
});

module.exports = router;
