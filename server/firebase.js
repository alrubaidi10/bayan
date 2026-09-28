const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { db, r2 } = require('./lib');

const https = require('https');

let firestoreInstance = null;
let initError = null;
let lastSyncTime = null;
let timeOffsetMs = 0;
let timeChecked = false;

function syncTimeWithGoogle() {
  return new Promise((resolve) => {
    if (timeChecked) return resolve(timeOffsetMs);
    const req = https.get('https://www.google.com', { timeout: 3000 }, (res) => {
      if (res.headers.date) {
        const googleTime = new Date(res.headers.date).getTime();
        const diff = Date.now() - googleTime;
        if (Math.abs(diff) > 20000) {
          timeOffsetMs = diff;
          const origNow = Date.now;
          Date.now = () => origNow() - timeOffsetMs;
        }
      }
      timeChecked = true;
      resolve(timeOffsetMs);
    });
    req.on('error', () => { timeChecked = true; resolve(0); });
    req.on('timeout', () => { req.destroy(); timeChecked = true; resolve(0); });
  });
}

function getServiceAccount() {
  // 1. Environment variable (Render / Production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      return raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e.message);
    }
  }

  // 2. Encoded config file (safe for git)
  const encPath = path.join(__dirname, 'firebase-key.enc');
  if (fs.existsSync(encPath)) {
    try {
      return JSON.parse(Buffer.from(fs.readFileSync(encPath, 'utf8').trim(), 'base64').toString('utf8'));
    } catch (e) {
      console.error('Failed to decode firebase-key.enc:', e.message);
    }
  }

  // 3. Raw local file
  const filePath = path.join(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error('Failed to parse firebase-service-account.json file:', e.message);
    }
  }
  return null;
}

function initFirebase() {
  if (firestoreInstance) return firestoreInstance;
  const sa = getServiceAccount();
  if (!sa) {
    initError = 'no_service_account';
    return null;
  }

  try {
    const apps = admin.getApps();
    const app = apps.length > 0
      ? admin.getApp()
      : admin.initializeApp({ credential: admin.cert(sa) });
    firestoreInstance = getFirestore(app);
    initError = null;
    return firestoreInstance;
  } catch (err) {
    initError = err.message;
    console.error('Firebase init error:', err.message);
    return null;
  }
}

/**
 * Backs up all operational & accounting data for a company to Firestore
 */
async function syncCompanyToFirestore(companyId) {
  await syncTimeWithGoogle();
  const fsDb = initFirebase();
  if (!fsDb) throw new Error(initError || 'firebase_not_configured');

  const cid = Number(companyId);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(cid);
  if (!company) throw new Error('company_not_found');

  const branches = db.prepare('SELECT * FROM branches WHERE company_id = ?').all(cid);
  const accounts = db.prepare('SELECT * FROM accounts WHERE company_id = ?').all(cid);
  const contacts = db.prepare('SELECT * FROM contacts WHERE company_id = ?').all(cid);
  const products = db.prepare('SELECT * FROM products WHERE company_id = ?').all(cid);
  const invoices = db.prepare('SELECT * FROM invoices WHERE company_id = ?').all(cid);
  const invoiceIds = invoices.map(i => i.id);
  const invoiceItems = invoiceIds.length > 0
    ? db.prepare(`SELECT * FROM invoice_items WHERE invoice_id IN (${invoiceIds.map(() => '?').join(',')})`).all(...invoiceIds)
    : [];
  const expenses = db.prepare('SELECT * FROM expenses WHERE company_id = ?').all(cid);
  const users = db.prepare('SELECT id, company_id, branch_id, name, email, password_hash, role, is_superadmin, created_at FROM users WHERE company_id = ?').all(cid);
  const quotes = db.prepare('SELECT * FROM quotes WHERE company_id = ?').all(cid);
  const stockTransfers = db.prepare('SELECT * FROM stock_transfers WHERE company_id = ?').all(cid);
  const stockMoves = db.prepare('SELECT * FROM stock_moves WHERE company_id = ?').all(cid);
  const journalEntries = db.prepare('SELECT * FROM journal_entries WHERE company_id = ?').all(cid);
  const entryIds = journalEntries.map(e => e.id);
  const journalLines = entryIds.length > 0
    ? db.prepare(`SELECT * FROM journal_lines WHERE entry_id IN (${entryIds.map(() => '?').join(',')})`).all(...entryIds)
    : [];
  const payments = db.prepare('SELECT * FROM payments WHERE company_id = ?').all(cid);

  const timestamp = new Date().toISOString();
  const backupPayload = {
    company_id: cid,
    timestamp,
    company,
    branches,
    users,
    accounts,
    contacts,
    products,
    invoices,
    invoiceItems,
    expenses,
    quotes,
    stockTransfers,
    stockMoves,
    journalEntries,
    journalLines,
    payments,
    counts: {
      branches: branches.length,
      users: users.length,
      accounts: accounts.length,
      contacts: contacts.length,
      products: products.length,
      invoices: invoices.length,
      expenses: expenses.length,
      journalEntries: journalEntries.length,
    }
  };

  // 1. Save latest state
  await fsDb.collection('companies').doc(String(cid)).set(backupPayload);

  // 2. Append to backup history
  const historyDocId = `${cid}_${timestamp.replace(/[:.]/g, '-')}`;
  await fsDb.collection('backups').doc(historyDocId).set(backupPayload);

  lastSyncTime = timestamp;
  return { success: true, timestamp, counts: backupPayload.counts };
}

/**
 * Restores data for a company from the latest Firestore snapshot
 */
async function restoreCompanyFromFirestore(companyId) {
  await syncTimeWithGoogle();
  const fsDb = initFirebase();
  if (!fsDb) throw new Error(initError || 'firebase_not_configured');

  const cid = Number(companyId);
  const doc = await fsDb.collection('companies').doc(String(cid)).get();
  if (!doc.exists) throw new Error('no_cloud_backup_found');

  const data = doc.data();

  // Perform atomic restore in transaction
  const restoreTx = db.transaction(() => {
    // Company info
    if (data.company) {
      const co = data.company;
      db.prepare(`
        UPDATE companies SET
          name = COALESCE(?, name),
          seller_name = COALESCE(?, seller_name),
          tax_no = COALESCE(?, tax_no),
          address = COALESCE(?, address),
          phone = COALESCE(?, phone),
          base_currency = COALESCE(?, base_currency)
        WHERE id = ?
      `).run(co.name, co.seller_name, co.tax_no, co.address, co.phone, co.base_currency, cid);
    }

    // Branches
    if (Array.isArray(data.branches)) {
      for (const b of data.branches) {
        db.prepare(`
          INSERT INTO branches (id, company_id, name, code, address, phone, is_active)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, code=excluded.code, address=excluded.address,
            phone=excluded.phone, is_active=excluded.is_active
        `).run(b.id, cid, b.name, b.code || '', b.address || '', b.phone || '', b.is_active ?? 1);
      }
    }

    // Users
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        db.prepare(`
          INSERT INTO users (id, company_id, branch_id, name, email, password_hash, role, is_superadmin, created_at)
          VALUES (?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            branch_id=excluded.branch_id, name=excluded.name, email=excluded.email,
            password_hash=excluded.password_hash, role=excluded.role, is_superadmin=excluded.is_superadmin
        `).run(u.id, cid, u.branch_id || null, u.name, u.email, u.password_hash, u.role || 'staff', u.is_superadmin || 0, u.created_at || new Date().toISOString());
      }
    }

    // Contacts
    if (Array.isArray(data.contacts)) {
      for (const c of data.contacts) {
        db.prepare(`
          INSERT INTO contacts (id, company_id, branch_id, kind, name, email, phone, address, tax_no, currency)
          VALUES (?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            branch_id=excluded.branch_id, name=excluded.name, email=excluded.email,
            phone=excluded.phone, address=excluded.address, tax_no=excluded.tax_no, currency=excluded.currency
        `).run(c.id, cid, c.branch_id || null, c.kind, c.name, c.email || '', c.phone || '', c.address || '', c.tax_no || '', c.currency || '');
      }
    }

    // Products
    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        db.prepare(`
          INSERT INTO products (id, company_id, branch_id, name, name_ar, category, sku, barcode, unit, cost, price, stock, reorder_level, is_active)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            branch_id=excluded.branch_id, name=excluded.name, name_ar=excluded.name_ar,
            category=excluded.category, sku=excluded.sku, barcode=excluded.barcode,
            unit=excluded.unit, cost=excluded.cost, price=excluded.price,
            stock=excluded.stock, reorder_level=excluded.reorder_level, is_active=excluded.is_active
        `).run(p.id, cid, p.branch_id || null, p.name, p.name_ar || '', p.category || '', p.sku || '', p.barcode || '', p.unit || 'pcs', p.cost || 0, p.price || 0, p.stock || 0, p.reorder_level || 0, p.is_active ? 1 : 0);
      }
    }

    // Invoices
    if (Array.isArray(data.invoices)) {
      for (const inv of data.invoices) {
        db.prepare(`
          INSERT INTO invoices (id, company_id, branch_id, kind, number, contact_id, date, due_date, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, payment_type, memo)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            status=excluded.status, payment_type=excluded.payment_type, memo=excluded.memo
        `).run(inv.id, cid, inv.branch_id || null, inv.kind, inv.number, inv.contact_id, inv.date, inv.due_date || null, inv.currency, inv.fx_rate, inv.subtotal, inv.tax_amount, inv.total, inv.subtotal_base, inv.tax_base, inv.total_base, inv.status, inv.payment_type || 'credit', inv.memo || '');
      }
    }

    // Invoice items
    if (Array.isArray(data.invoiceItems)) {
      for (const item of data.invoiceItems) {
        db.prepare(`
          INSERT INTO invoice_items (id, invoice_id, product_id, description, qty, unit_price, amount, base_amount, currency, fx_rate)
          VALUES (?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            qty=excluded.qty, unit_price=excluded.unit_price, amount=excluded.amount, base_amount=excluded.base_amount
        `).run(item.id, item.invoice_id, item.product_id || null, item.description || '', item.qty, item.unit_price, item.amount, item.base_amount, item.currency || 'USD', item.fx_rate || 1);
      }
    }

    // Expenses
    if (Array.isArray(data.expenses)) {
      for (const exp of data.expenses) {
        db.prepare(`
          INSERT INTO expenses (id, company_id, branch_id, date, category, amount, currency, fx_rate, base_amount, account_id, memo)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            amount=excluded.amount, base_amount=excluded.base_amount, memo=excluded.memo
        `).run(exp.id, cid, exp.branch_id || null, exp.date, exp.category || '', exp.amount, exp.currency || 'USD', exp.fx_rate || 1, exp.base_amount, exp.account_id || null, exp.memo || '');
      }
    }

    // Quotes
    if (Array.isArray(data.quotes)) {
      for (const q of data.quotes) {
        db.prepare(`
          INSERT INTO quotes (id, company_id, branch_id, number, contact_id, date, expiry_date, currency, fx_rate, subtotal, tax_amount, total, status, memo)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            status=excluded.status, memo=excluded.memo
        `).run(q.id, cid, q.branch_id || null, q.number, q.contact_id, q.date, q.expiry_date || null, q.currency || 'USD', q.fx_rate || 1, q.subtotal, q.tax_amount, q.total, q.status || 'draft', q.memo || '');
      }
    }
  });

  restoreTx();
  return { success: true, restoredAt: new Date().toISOString(), backupTimestamp: data.timestamp, counts: data.counts };
}

/* Debounced background auto-sync */
const syncDebounceTimers = new Map();

function triggerAutoSync(companyId) {
  if (!companyId) return;
  const cid = Number(companyId);
  if (syncDebounceTimers.has(cid)) {
    clearTimeout(syncDebounceTimers.get(cid));
  }
  const timer = setTimeout(async () => {
    syncDebounceTimers.delete(cid);
    try {
      await syncCompanyToFirestore(cid);
      console.log(`[Firebase LiveSync] Company ${cid} automatically synced to Firestore.`);
    } catch (err) {
      console.error(`[Firebase LiveSync] Auto-sync failed for company ${cid}:`, err.message);
    }
  }, 3500); // 3.5s debounce
  syncDebounceTimers.set(cid, timer);
}

/* Auto-restore on server boot if database is fresh / empty */
async function autoRestoreOnBoot() {
  const fsDb = initFirebase();
  if (!fsDb) return;
  try {
    await syncTimeWithGoogle();
    const companiesSnapshot = await fsDb.collection('companies').get();
    if (companiesSnapshot.empty) return;

    const invoicesCount = db.prepare('SELECT COUNT(*) n FROM invoices').get().n;
    if (invoicesCount === 0) {
      console.log('[Firebase Boot] Detected empty invoices table. Restoring latest cloud snapshot from Firestore...');
      for (const doc of companiesSnapshot.docs) {
        await restoreCompanyFromFirestore(doc.id);
        console.log(`[Firebase Boot] Restored company ${doc.id} from Firestore.`);
      }
    }
  } catch (err) {
    console.error('[Firebase Boot] Auto-restore on boot error:', err.message);
  }
}

/* Periodic cloud heartbeat backup */
function startPeriodicSync(intervalMinutes = 30) {
  setInterval(async () => {
    try {
      const companies = db.prepare('SELECT id FROM companies').all();
      for (const co of companies) {
        await syncCompanyToFirestore(co.id);
      }
      console.log(`[Firebase PeriodicSync] Synced ${companies.length} companies to Firestore.`);
    } catch (err) {
      console.error('[Firebase PeriodicSync] Error during periodic sync:', err.message);
    }
  }, intervalMinutes * 60 * 1000);
}

function getStatus() {
  const sa = getServiceAccount();
  return {
    configured: !!sa,
    projectId: sa ? sa.project_id : null,
    clientEmail: sa ? sa.client_email : null,
    lastSync: lastSyncTime,
    error: initError,
  };
}

module.exports = {
  initFirebase,
  syncCompanyToFirestore,
  restoreCompanyFromFirestore,
  triggerAutoSync,
  autoRestoreOnBoot,
  startPeriodicSync,
  getStatus,
};

