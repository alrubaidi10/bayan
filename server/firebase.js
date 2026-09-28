const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { db, r2 } = require('./lib');

let firestoreInstance = null;
let initError = null;
let lastSyncTime = null;

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
    const app = admin.apps.length > 0
      ? admin.app()
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
  const fsDb = initFirebase();
  if (!fsDb) throw new Error(initError || 'firebase_not_configured');

  const cid = Number(companyId);
  const doc = await fsDb.collection('companies').doc(String(cid)).get();
  if (!doc.exists) throw new Error('no_cloud_backup_found');

  const data = doc.data();

  // Perform atomic restore in transaction
  const restoreTx = db.transaction(() => {
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
  });

  restoreTx();
  return { success: true, restoredAt: new Date().toISOString(), backupTimestamp: data.timestamp, counts: data.counts };
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
  getStatus,
};
