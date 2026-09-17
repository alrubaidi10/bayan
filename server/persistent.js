const fs = require('fs');
const path = require('path');
const db = require('./db');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const storePath = path.join(dataDir, 'persistent_accounts.json');

function readStore() {
  try {
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading persistent_accounts.json:', e);
  }
  return { companies: [], users: [] };
}

function writeStore(store) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing persistent_accounts.json:', e);
  }
}

/** Syncs a company and user into the persistent JSON backup file */
function syncAccount(company, user) {
  const store = readStore();

  const cIdx = store.companies.findIndex(c => c.id === company.id || c.name === company.name);
  if (cIdx >= 0) store.companies[cIdx] = company;
  else store.companies.push(company);

  const uIdx = store.users.findIndex(u => u.email === user.email);
  if (uIdx >= 0) store.users[uIdx] = user;
  else store.users.push(user);

  writeStore(store);
}

/** Removes a company and its users from persistent store */
function removeAccount(companyId) {
  const store = readStore();
  store.companies = store.companies.filter(c => c.id !== companyId);
  store.users = store.users.filter(u => u.company_id !== companyId);
  writeStore(store);
}

/** Restores all persisted companies and users into the SQLite DB if missing */
function restorePersistentAccounts() {
  const store = readStore();
  if (!store.companies.length && !store.users.length) return;

  const { createCompany } = require('./seed');

  for (const c of store.companies) {
    let existingCompany = db.prepare('SELECT * FROM companies WHERE id = ? OR name = ?').get(c.id, c.name);
    if (!existingCompany) {
      existingCompany = createCompany({ name: c.name, base_currency: c.base_currency || 'USD' });
      db.prepare('UPDATE companies SET plan=?, status=?, subscription_start=?, subscription_end=? WHERE id=?')
        .run(c.plan || 'active', c.status || 'active', c.subscription_start || null, c.subscription_end || null, existingCompany.id);
    } else {
      db.prepare('UPDATE companies SET plan=?, status=?, subscription_start=?, subscription_end=? WHERE id=?')
        .run(c.plan || existingCompany.plan, c.status || existingCompany.status, c.subscription_start || existingCompany.subscription_start, c.subscription_end || existingCompany.subscription_end, existingCompany.id);
    }

    // Restore users for this company
    const companyUsers = store.users.filter(u => u.company_id === c.id || u.company_name === c.name);
    for (const u of companyUsers) {
      const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(u.email);
      if (!existingUser) {
        db.prepare('INSERT INTO users (company_id, name, email, password_hash, role, is_superadmin) VALUES (?,?,?,?,?,?)')
          .run(existingCompany.id, u.name, u.email, u.password_hash, u.role || 'admin', u.is_superadmin ? 1 : 0);
      } else {
        db.prepare('UPDATE users SET password_hash = ?, name = ?, role = ? WHERE id = ?')
          .run(u.password_hash, u.name, u.role || existingUser.role, existingUser.id);
      }
    }
  }
}

module.exports = { syncAccount, removeAccount, restorePersistentAccounts };
