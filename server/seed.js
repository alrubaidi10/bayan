/**
 * Seeding: default chart of accounts + currencies for any new company,
 * plus a rich demo dataset when demo=1.
 */
const { db, hashPassword, postInvoice, recordPayment, r2 } = require('./lib');

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
  { code: 'YER', symbol: '﷼', name: 'Yemeni Rial', rate: 250 },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', rate: 3.75 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92 },
];

const COA = [
  ['1000', 'Cash and Banks', 'النقدية والبنوك', 'asset'],
  ['1100', 'Accounts Receivable', 'العملاء - ذمم مدينة', 'asset'],
  ['1200', 'Inventory', 'المخزون', 'asset'],
  ['1300', 'Equipment & Fixed Assets', 'الأصول الثابتة - معدات', 'asset'],
  ['1400', 'Prepaid Expenses', 'مصاريف مدفوعة مقدماً', 'asset'],
  ['2100', 'Accounts Payable', 'الموردون - ذمم دائنة', 'liability'],
  ['2200', 'Sales Tax Payable', 'ضريبة المبيعات المستحقة', 'liability'],
  ['2300', 'Loans Payable', 'قروض مستحقة', 'liability'],
  ['3100', "Owner's Equity", 'رأس المال', 'equity'],
  ['3200', 'Retained Earnings', 'الأرباح المحتجزة', 'equity'],
  ['4000', 'Sales Revenue', 'إيرادات المبيعات', 'income'],
  ['4100', 'Service Revenue', 'إيرادات الخدمات', 'income'],
  ['4200', 'Other Income', 'إيرادات أخرى', 'income'],
  ['5000', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة', 'expense'],
  ['5100', 'Rent Expense', 'الإيجار', 'expense'],
  ['5200', 'Salaries & Wages', 'الرواتب والأجور', 'expense'],
  ['5300', 'Utilities', 'المرافق (كهرباء وماء)', 'expense'],
  ['5400', 'Marketing & Advertising', 'التسويق والإعلان', 'expense'],
  ['5500', 'Office Supplies', 'مستلزمات مكتبية', 'expense'],
  ['5600', 'Depreciation', 'الإهلاك', 'expense'],
  ['5900', 'Miscellaneous Expense', 'مصاريف متفرقة', 'expense'],
];

/** Create a company + its chart of accounts + currencies. Returns company row. */
function createCompany({ name, base_currency = 'USD', tax_enabled = 0, tax_rate = 0 }) {
  const info = db.prepare('INSERT INTO companies (name, base_currency, tax_enabled, tax_rate) VALUES (?,?,?,?)')
    .run(name, base_currency, tax_enabled, tax_rate);
  const companyId = info.lastInsertRowid;

  const insAcc = db.prepare('INSERT INTO accounts (company_id, code, name, name_ar, type) VALUES (?,?,?,?,?)');
  for (const [code, n, nar, type] of COA) insAcc.run(companyId, code, n, nar, type);

  // rates are "units of this currency per 1 base unit"; seeded relative to USD
  const baseRate = CURRENCIES.find(c => c.code === base_currency)?.rate || 1;
  const insCur = db.prepare('INSERT INTO currencies (company_id, code, symbol, name, rate) VALUES (?,?,?,?,?)');
  for (const c of CURRENCIES) insCur.run(companyId, c.code, c.symbol, c.name, Math.round((c.rate / baseRate) * 1e6) / 1e6);

  return db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
}

/* ---------- Demo dataset ---------- */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}
// deterministic RNG so demo data is stable
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedDemo(companyId) {
  const rand = mulberry32(42);
  const ins = {
    contact: db.prepare('INSERT INTO contacts (company_id, kind, name, email, phone, address, tax_no) VALUES (?,?,?,?,?,?,?)'),
    product: db.prepare('INSERT INTO products (company_id, name, name_ar, category, sku, barcode, unit, cost, price, stock, reorder_level) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
    invoice: db.prepare('INSERT INTO invoices (company_id, kind, number, contact_id, date, due_date, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'),
    item: db.prepare('INSERT INTO invoice_items (invoice_id, product_id, description, qty, unit_price, amount, base_amount, currency, fx_rate) VALUES (?,?,?,?,?,?,?,?,?)'),
    expense: db.prepare('INSERT INTO expenses (company_id, date, account_id, contact_id, currency, fx_rate, amount, base_amount, tax_amount, memo, payment_account_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
  };
  const acc = (code) => db.prepare('SELECT id FROM accounts WHERE company_id=? AND code=?').get(companyId, code).id;

  /* Contacts */
  const customers = [
    ['Alpha Trading Co.', 'info@alphatrading.example', '+967 771 234 567', 'Sanaa, Yemen', 'YE-1001'],
    ['Blue Star Store', 'sales@bluestar.example', '+967 733 111 222', 'Aden, Yemen', 'YE-1002'],
    ['Gulf Tech Solutions', 'hello@gulftech.example', '+971 50 123 4567', 'Dubai, UAE', 'AE-2003'],
    ['Red Sea Retail', 'buy@redsearetail.example', '+967 777 555 333', 'Hodeidah, Yemen', 'YE-1004'],
  ];
  const suppliers = [
    ['Global Supplies Co.', 'orders@globalsupplies.example', '+971 4 555 8899', 'Dubai, UAE', 'AE-3301'],
    ['Metro Wholesale', 'metro@metro-wholesale.example', '+966 11 222 3344', 'Riyadh, KSA', 'SA-2202'],
    ['TechParts Ltd.', 'sales@techparts.example', '+852 5555 1234', 'Hong Kong', 'HK-4403'],
  ];
  const custIds = customers.map(c => ins.contact.run(companyId, 'customer', ...c).lastInsertRowid);
  const suppIds = suppliers.map(c => ins.contact.run(companyId, 'supplier', ...c).lastInsertRowid);

  /* Products (cost, price in USD) */
  const products = [
    ['Laptop Pro 14"', 'لابتوب برو 14', 'Electronics', 'LP14', '6291041500213', 'pcs', 620, 780, 28, 6],
    ['Wireless Mouse', 'ماوس لاسلكي', 'Electronics', 'MSE-01', '6291041500220', 'pcs', 9, 15, 150, 40],
    ['USB-C Hub 7in1', 'موزع USB-C', 'Accessories', 'HUB-7', '6291041500237', 'pcs', 18, 29, 60, 20],
    ['27" 4K Monitor', 'شاشة 27 بوصة', 'Electronics', 'MON-27', '6291041500244', 'pcs', 190, 260, 18, 5],
    ['Ergonomic Chair', 'كرسي مكتب مريح', 'Furniture', 'CHR-01', '6291041500251', 'pcs', 85, 140, 22, 8],
    ['LED Desk Lamp', 'مصباح مكتب LED', 'Furniture', 'LMP-01', '6291041500268', 'pcs', 8, 15, 90, 30],
  ];
  const prodIds = products.map(p => ins.product.run(companyId, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9]).lastInsertRowid);

  /* Opening entry: cash + equipment funded by owner's equity */
  const lines = [
    { account_id: acc('1000'), debit: 25000, credit: 0 },
    { account_id: acc('1300'), debit: 6000, credit: 0 },
    { account_id: acc('3100'), debit: 0, credit: 31000 },
  ];
  const { createEntry } = require('./lib');
  createEntry(companyId, monthsAgo(5), 'Opening balances', 'JE-0001', 'manual', 0, lines);

  /* Purchase bills (stock in, AP credit) */
  const bills = [
    { m: 5, d: 8, sup: 0, items: [[0, 30, 620], [1, 200, 9], [2, 100, 18]], cur: 'USD' },
    { m: 4, d: 15, sup: 1, items: [[3, 25, 190], [4, 40, 85], [5, 120, 8]], cur: 'USD' },
    { m: 2, d: 20, sup: 2, items: [[0, 10, 600], [1, 100, 8.5], [3, 8, 185]], cur: 'USD' },
  ];
  const billIds = [];
  let billNo = 1;
  for (const b of bills) {
    const rate = 1;
    let sub = 0;
    for (const [pi, qty, price] of b.items) sub += qty * price;
    const invId = ins.invoice.run(companyId, 'purchase', 'BILL-' + String(billNo).padStart(4, '0'),
      suppIds[b.sup], monthsAgo(b.m), null, b.cur, rate, r2(sub), 0, r2(sub), r2(sub / rate), 0, r2(sub / rate), 'draft', 'Stock replenishment').lastInsertRowid;
    billIds.push(invId);
    for (const [pi, qty, price] of b.items) {
      ins.item.run(invId, prodIds[pi], products[pi][0], qty, price, r2(qty * price), r2(qty * price / rate), b.cur, rate);
    }
    postInvoice(companyId, db.prepare('SELECT * FROM invoices WHERE id=?').get(invId));
    billNo++;
  }
  // pay the first bill partially from cash
  const b1 = db.prepare('SELECT * FROM invoices WHERE id=?').get(billIds[0]);
  recordPayment(companyId, b1, { date: monthsAgo(4).slice(0, 8) + '10', amount: 15000, accountId: acc('1000'), memo: 'Partial payment to Global Supplies' });

  /* Monthly sales */
  const priceOf = (pi, mult) => r2(products[pi][7] * mult);  // [name, name_ar, category, sku, barcode, unit, cost, price, stock, reorder]
  const salesPlan = [
    { m: 4, d: 12, cust: 0, items: [[0, 5, 1], [1, 40, 1], [2, 25, 1]], cur: 'USD', pay: true },
    { m: 4, d: 28, cust: 1, items: [[3, 6, 1], [5, 30, 1]], cur: 'USD', pay: true },
    { m: 3, d: 10, cust: 2, items: [[0, 4, 1.05], [2, 20, 1.1]], cur: 'SAR', pay: true },
    { m: 3, d: 25, cust: 3, items: [[4, 10, 1], [1, 50, 1]], cur: 'USD', pay: true },
    { m: 2, d: 9, cust: 0, items: [[0, 6, 1], [3, 4, 1.02]], cur: 'USD', pay: true },
    { m: 2, d: 22, cust: 1, items: [[5, 40, 1], [2, 30, 1]], cur: 'USD', pay: false },
    { m: 1, d: 11, cust: 2, items: [[0, 5, 1.03], [4, 8, 1]], cur: 'USD', pay: false },
    { m: 1, d: 26, cust: 3, items: [[1, 60, 1], [3, 5, 1]], cur: 'USD', pay: false },
    { m: 0, d: 8, cust: 0, items: [[0, 7, 1], [2, 15, 1.05], [5, 25, 1]], cur: 'USD', pay: false },
    { m: 0, d: 20, cust: 1, items: [[3, 6, 1.05], [4, 6, 1.05]], cur: 'YER', pay: false },
  ];
  let invNo = 1;
  for (const s of salesPlan) {
    const rate = db.prepare('SELECT rate FROM currencies WHERE company_id=? AND code=?').get(companyId, s.cur).rate;
    let sub = 0;
    for (const [pi, qty, mult] of s.items) sub += qty * priceOf(pi, mult);
    const date = monthsAgo(s.m).slice(0, 8) + String(s.d).padStart(2, '0');
    const invId = ins.invoice.run(companyId, 'sale', 'INV-' + String(invNo).padStart(4, '0'),
      custIds[s.cust], date, monthsAgo(Math.max(0, s.m - 1)), s.cur, rate, r2(sub), 0, r2(sub), r2(sub / rate), 0, r2(sub / rate), 'draft', '').lastInsertRowid;
    for (const [pi, qty, mult] of s.items) {
      const p = priceOf(pi, mult);
      ins.item.run(invId, prodIds[pi], products[pi][0], qty, p, r2(qty * p), r2(qty * p / rate), s.cur, rate);
    }
    postInvoice(companyId, db.prepare('SELECT * FROM invoices WHERE id=?').get(invId));
    if (s.pay) {
      const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(invId);
      recordPayment(companyId, inv, { date, amount: inv.total, accountId: acc('1000'), memo: 'Payment ' + inv.number });
    }
    invNo++;
  }

  /* Service revenue invoice (no inventory) */
  {
    const rate = 1;
    const invId = ins.invoice.run(companyId, 'sale', 'INV-' + String(invNo).padStart(4, '0'),
      custIds[2], monthsAgo(1).slice(0, 8) + '05', monthsAgo(0), 'USD', rate, 2400, 0, 2400, 2400, 0, 2400, 'draft', 'IT support & consulting retainer').lastInsertRowid;
    ins.item.run(invId, null, 'IT consulting retainer (monthly)', 1, 2400, 2400, 2400, 'USD', 1);
    postInvoice(companyId, db.prepare('SELECT * FROM invoices WHERE id=?').get(invId));
    const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(invId);
    recordPayment(companyId, inv, { date: monthsAgo(1).slice(0, 8) + '15', amount: 1200, accountId: acc('1000'), memo: 'Partial payment' });
  }

  /* Monthly operating expenses */
  const ops = [
    { acc: '5100', amt: 1500, memo: 'Office rent' },
    { acc: '5200', amt: 4200, memo: 'Salaries' },
    { acc: '5300', amt: 380, memo: 'Electricity & water' },
    { acc: '5400', amt: 500, memo: 'Marketing campaign' },
    { acc: '5500', amt: 120, memo: 'Office supplies' },
  ];
  for (let m = 4; m >= 0; m--) {
    for (const o of ops) {
      ins.expense.run(companyId, monthsAgo(m).slice(0, 8) + '28', acc(o.acc), null, 'USD', 1, o.amt, o.amt, 0, o.memo, acc('1000'));
    }
  }

  /* Adjusting entries: depreciation */
  for (let m = 4; m >= 1; m--) {
    createEntry(companyId, monthsAgo(m) + '-31', 'Monthly depreciation', 'ADJ-' + (5 - m), 'manual', 0, [
      { account_id: acc('5600'), debit: 100, credit: 0 },
      { account_id: acc('1300'), debit: 0, credit: 100 },
    ]);
  }

  /* Quotations (عروض أسعار) */
  const qQuote = db.prepare(`INSERT INTO quotes (company_id, number, contact_id, date, valid_until, currency, fx_rate, subtotal, tax_amount, total, subtotal_base, tax_base, total_base, status, memo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const qItem = db.prepare('INSERT INTO quote_items (quote_id, product_id, description, qty, unit_price, amount, currency, fx_rate) VALUES (?,?,?,?,?,?,?,?)');
  {
    const items = [[0, 8, 780], [1, 100, 15], [2, 50, 29]];
    let sub = 0; for (const [pi, qty, pr] of items) sub += qty * pr;
    const id = qQuote.run(companyId, 'QT-0001', custIds[0], monthsAgo(0), daysAgo(-15), 'USD', 1, sub, 0, sub, sub, 0, sub, 'sent', 'Office equipment upgrade — price valid for 15 days').lastInsertRowid;
    for (const [pi, qty, pr] of items) qItem.run(id, prodIds[pi], products[pi][0], qty, pr, qty * pr, 'USD', 1);
  }
  {
    const items = [[3, 5, 260], [4, 12, 140]];
    let sub = 0; for (const [pi, qty, pr] of items) sub += qty * pr;
    const id = qQuote.run(companyId, 'QT-0002', custIds[2], daysAgo(3), daysAgo(-30), 'USD', 1, sub, 0, sub, sub, 0, sub, 'draft', 'Workstations for the new branch').lastInsertRowid;
    for (const [pi, qty, pr] of items) qItem.run(id, prodIds[pi], products[pi][0], qty, pr, qty * pr, 'USD', 1);
  }

  /* Notifications from the platform admin */
  db.prepare('INSERT INTO notifications (company_id, subject, message, sender_name) VALUES (?,?,?,?)').run(companyId,
    'Welcome to Mizan ERP',
    'Your workspace is ready. Check the Reports section to print invoices, statements and quotations. For any question, reply to this message.',
    'Mizan Admin');
  db.prepare('INSERT INTO notifications (company_id, subject, message, sender_name) VALUES (?,?,?,?)').run(companyId,
    'Subscription reminder',
    'Your subscription is active. You can always see the remaining days in the top bar. Contact the admin to renew or upgrade your plan.',
    'Mizan Admin');
}

/** Ensures the demo account exists and returns it. */
function ensureDemoAccount() {
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get('demo@mizan.local');
  if (user) {
    const comp = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id);
    return { user, company: comp, fresh: false };
  }
  const company = createCompany({ name: 'Mizan Demo Co.', base_currency: 'USD', tax_enabled: 0, tax_rate: 0 });
  seedDemo(company.id);
  const info = db.prepare('INSERT INTO users (company_id, name, email, password_hash, role) VALUES (?,?,?,?,?)')
    .run(company.id, 'Demo Admin', 'demo@mizan.local', hashPassword('demo1234'), 'admin');
  return {
    user: db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid),
    company, fresh: true,
  };
}

/** Ensures the platform super-admin exists (manages all customer companies).
 *  Credentials are defined in code and stored hashed (scrypt) — never in plain text.
 *  Email: hexasec10@gmail.com */
function ensureSuperAdmin() {
  const ADMIN_EMAIL = 'hexasec10@gmail.com';
  const ADMIN_PASSWORD = 'sqlmapkali2002#$';
  let u = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (u) {
    // keep the hash in sync with the code-defined password (idempotent re-seed)
    db.prepare('UPDATE users SET password_hash = ?, is_superadmin = 1 WHERE id = ?')
      .run(hashPassword(ADMIN_PASSWORD), u.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  }
  // migrate the old default admin email if it exists from a previous version
  const old = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@mizan.local');
  if (old) {
    db.prepare('UPDATE users SET email = ?, name = ?, password_hash = ?, is_superadmin = 1 WHERE id = ?')
      .run(ADMIN_EMAIL, 'Bayan Admin', hashPassword(ADMIN_PASSWORD), old.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(old.id);
  }
  const demo = ensureDemoAccount();
  // make sure the demo company has a long-running subscription (never locked)
  const end = new Date(Date.now() + 3650 * 864e5).toISOString().slice(0, 10);
  db.prepare("UPDATE companies SET plan='premium', status='active', subscription_start=?, subscription_end=? WHERE id=?")
    .run(new Date().toISOString().slice(0, 10), end, demo.company.id);
  const info = db.prepare("INSERT INTO users (company_id, name, email, password_hash, role, is_superadmin) VALUES (?,?,?,?,?,1)")
    .run(demo.company.id, 'Bayan Admin', ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD), 'admin');
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

module.exports = { createCompany, seedDemo, ensureDemoAccount, ensureSuperAdmin, CURRENCIES, COA };

if (require.main === module) {
  const { user, company, fresh } = ensureDemoAccount();
  console.log(fresh
    ? `Created demo company "${company.name}" with full demo data (id ${company.id}).`
    : `Demo company "${company.name}" already exists (id ${company.id}).`);
  console.log('Sign in with: demo@mizan.local / demo1234');
}
