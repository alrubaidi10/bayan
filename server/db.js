const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Desktop mode: use user-specific database
const isDesktop = process.env.DESKTOP_MODE === '1' || process.env.FIREBASE_MODE === 'embedded';
const dataDir = isDesktop ? (process.env.DATA_DIR || path.join(require('electron').app.getPath('userData'), 'database')) : (process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'erp.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  tax_enabled INTEGER NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS currencies (
  company_id INTEGER NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  rate REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (company_id, code)
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','income','expense')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL CHECK(kind IN ('customer','supplier')),
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  tax_no TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  name_ar TEXT DEFAULT '',
  sku TEXT DEFAULT '',
  unit TEXT DEFAULT 'pcs',
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  date TEXT NOT NULL,
  memo TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  source_id INTEGER DEFAULT 0,
  posted INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL CHECK(kind IN ('sale','purchase')),
  number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  date TEXT NOT NULL,
  due_date TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate REAL NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  memo TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  posted_at TEXT,
  UNIQUE (company_id, kind, number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT DEFAULT '',
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  base_amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  base_amount REAL NOT NULL DEFAULT 0,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  memo TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  date TEXT NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  contact_id INTEGER REFERENCES contacts(id),
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate REAL NOT NULL DEFAULT 1,
  amount REAL NOT NULL DEFAULT 0,
  base_amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  memo TEXT DEFAULT '',
  payment_account_id INTEGER REFERENCES accounts(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  date TEXT NOT NULL,
  qty REAL NOT NULL,
  ref_type TEXT NOT NULL,
  ref_id INTEGER NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  number TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  date TEXT NOT NULL,
  valid_until TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate REAL NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  memo TEXT DEFAULT '',
  converted_invoice_id INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, number)
);

CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT DEFAULT '',
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  sender_name TEXT DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_inv_company ON invoices(company_id, kind);
CREATE INDEX IF NOT EXISTS idx_moves_product ON stock_moves(product_id);
CREATE INDEX IF NOT EXISTS idx_notif_company ON notifications(company_id);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  number TEXT NOT NULL,
  date TEXT NOT NULL,
  from_location TEXT NOT NULL DEFAULT 'المستودع الرئيسي',
  to_location TEXT NOT NULL DEFAULT 'فرع',
  memo TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_transfers_company ON stock_transfers(company_id);
`);

/* ---------- Migrations for subscription/superadmin (keeps existing DBs) ---------- */
function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('companies', 'plan', "plan TEXT NOT NULL DEFAULT 'active'");
ensureColumn('companies', 'subscription_start', "subscription_start TEXT");
ensureColumn('companies', 'subscription_end', "subscription_end TEXT");
ensureColumn('companies', 'status', "status TEXT NOT NULL DEFAULT 'active'");
ensureColumn('users', 'is_superadmin', "is_superadmin INTEGER NOT NULL DEFAULT 0");
ensureColumn('contacts', 'currency', "currency TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'category', "category TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'barcode', "barcode TEXT NOT NULL DEFAULT ''");
/* Backfill: users with role='staff' keep it; users with old role='admin' stay as 'admin' */
/* New valid roles: admin | manager | accountant | staff | cashier */
db.exec(`UPDATE users SET role = 'admin' WHERE role NOT IN ('admin','manager','accountant','staff','cashier')`);

ensureColumn('invoice_items', 'currency', "currency TEXT NOT NULL DEFAULT ''");
ensureColumn('invoice_items', 'fx_rate', "fx_rate REAL NOT NULL DEFAULT 1");
ensureColumn('invoices', 'subtotal_base', "subtotal_base REAL NOT NULL DEFAULT 0");
ensureColumn('invoices', 'tax_base', "tax_base REAL NOT NULL DEFAULT 0");
ensureColumn('invoices', 'total_base', "total_base REAL NOT NULL DEFAULT 0");
ensureColumn('quote_items', 'currency', "currency TEXT NOT NULL DEFAULT ''");
ensureColumn('quote_items', 'fx_rate', "fx_rate REAL NOT NULL DEFAULT 1");
ensureColumn('quote_items', 'base_amount', "base_amount REAL NOT NULL DEFAULT 0");
ensureColumn('quotes', 'subtotal_base', "subtotal_base REAL NOT NULL DEFAULT 0");
ensureColumn('quotes', 'tax_base', "tax_base REAL NOT NULL DEFAULT 0");
ensureColumn('quotes', 'total_base', "total_base REAL NOT NULL DEFAULT 0");

// Seller info on companies
ensureColumn('companies', 'seller_name', "seller_name TEXT NOT NULL DEFAULT ''");
ensureColumn('companies', 'tax_no', "tax_no TEXT NOT NULL DEFAULT ''");
ensureColumn('companies', 'address', "address TEXT NOT NULL DEFAULT ''");
ensureColumn('companies', 'phone', "phone TEXT NOT NULL DEFAULT ''");
// Invoice payment type
ensureColumn('invoices', 'payment_type', "payment_type TEXT NOT NULL DEFAULT 'credit'");
// Return invoice tracking
ensureColumn('invoices', 'return_of_id', "return_of_id INTEGER DEFAULT NULL");
ensureColumn('invoices', 'returned_qty', "returned_qty REAL NOT NULL DEFAULT 0");

/* Backfill base-currency totals for rows created before per-line currency support */
db.exec(`UPDATE invoices SET subtotal_base = ROUND(subtotal/fx_rate,2), tax_base = ROUND(tax_amount/fx_rate,2), total_base = ROUND(total/fx_rate,2)
  WHERE total_base IS NULL OR total_base = 0`);
db.exec(`UPDATE quotes SET subtotal_base = ROUND(subtotal/fx_rate,2), tax_base = ROUND(tax_amount/fx_rate,2), total_base = ROUND(total/fx_rate,2)
  WHERE total_base IS NULL OR total_base = 0`);

// Branches table
db.exec(`CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);`);

// Auto-create a default branch for each company that doesn't have one yet
const companiesWithoutBranch = db.prepare(
  'SELECT id, name FROM companies WHERE id NOT IN (SELECT DISTINCT company_id FROM branches)'
).all();
for (const co of companiesWithoutBranch) {
  db.prepare('INSERT INTO branches (company_id, name, code) VALUES (?,?,?)').run(co.id, 'الفرع الرئيسي', 'MAIN');
}

// Add branch_id to key tables
ensureColumn('users', 'branch_id', 'branch_id INTEGER DEFAULT NULL');
ensureColumn('contacts', 'branch_id', 'branch_id INTEGER DEFAULT NULL');
ensureColumn('products', 'branch_id', 'branch_id INTEGER DEFAULT NULL');
ensureColumn('invoices', 'branch_id', 'branch_id INTEGER DEFAULT NULL');
ensureColumn('expenses', 'branch_id', 'branch_id INTEGER DEFAULT NULL');
ensureColumn('quotes', 'branch_id', 'branch_id INTEGER DEFAULT NULL');
ensureColumn('stock_transfers', 'branch_id', 'branch_id INTEGER DEFAULT NULL');
ensureColumn('journal_entries', 'branch_id', 'branch_id INTEGER DEFAULT NULL');

// Backfill: assign existing records to the default branch (MAIN)
// Find each company's main branch
const mainBranches = db.prepare('SELECT id, company_id FROM branches WHERE code = ? OR id IN (SELECT MIN(id) FROM branches GROUP BY company_id)').all('MAIN');
for (const mb of mainBranches) {
  const bid = mb.id;
  const cid = mb.company_id;
  db.prepare('UPDATE contacts SET branch_id = ? WHERE company_id = ? AND branch_id IS NULL').run(bid, cid);
  db.prepare('UPDATE products SET branch_id = ? WHERE company_id = ? AND branch_id IS NULL').run(bid, cid);
  db.prepare('UPDATE invoices SET branch_id = ? WHERE company_id = ? AND branch_id IS NULL').run(bid, cid);
  db.prepare('UPDATE expenses SET branch_id = ? WHERE company_id = ? AND branch_id IS NULL').run(bid, cid);
  db.prepare('UPDATE quotes SET branch_id = ? WHERE company_id = ? AND branch_id IS NULL').run(bid, cid);
  db.prepare('UPDATE stock_transfers SET branch_id = ? WHERE company_id = ? AND branch_id IS NULL').run(bid, cid);
  db.prepare('UPDATE journal_entries SET branch_id = ? WHERE company_id = ? AND branch_id IS NULL').run(bid, cid);
}

// Product serials (IMEI / Serial Numbers for mobile phones & telecom devices)
db.exec(`CREATE TABLE IF NOT EXISTS product_serials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  branch_id INTEGER REFERENCES branches(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  serial_number TEXT NOT NULL,
  serial_number_2 TEXT DEFAULT '',
  batch_number TEXT DEFAULT '',
  storage TEXT DEFAULT '',
  ram TEXT DEFAULT '',
  color TEXT DEFAULT '',
  shelf_location TEXT DEFAULT '',
  condition TEXT NOT NULL DEFAULT 'new',
  status TEXT NOT NULL DEFAULT 'available',
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  invoice_id INTEGER DEFAULT NULL,
  purchase_bill_id INTEGER DEFAULT NULL,
  sold_at TEXT DEFAULT NULL,
  warranty_months INTEGER DEFAULT 24,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_serials_company ON product_serials(company_id);
CREATE INDEX IF NOT EXISTS idx_serials_product ON product_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_serials_sn ON product_serials(company_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_serials_status ON product_serials(company_id, status);`);

ensureColumn('products', 'brand', "brand TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'model', "model TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'storage', "storage TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'color', "color TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'ram', "ram TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'has_serials', "has_serials INTEGER NOT NULL DEFAULT 1");

module.exports = db;
