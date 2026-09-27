const crypto = require('crypto');
const db = require('./db');

/* ---------------- Auth ---------------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}
function newToken() { return crypto.randomBytes(24).toString('hex'); }

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  const s = db.prepare(`SELECT s.token, s.user_id, s.expires_at, u.company_id, u.name AS user_name,
      u.email, u.is_superadmin, c.name AS company_name, c.base_currency, c.tax_enabled, c.tax_rate,
      c.plan, c.subscription_end, c.status
      FROM sessions s JOIN users u ON u.id = s.user_id JOIN companies c ON c.id = u.company_id
      WHERE s.token = ?`).get(token);
  if (!s || new Date(s.expires_at) < new Date()) return res.status(401).json({ error: 'unauthorized' });
  // Subscription enforcement (super admin is exempt)
  if (!s.is_superadmin) {
    if (s.status === 'suspended') return res.status(403).json({ error: 'account_suspended' });
    const today = new Date().toISOString().slice(0, 10);
    if (s.subscription_end && s.subscription_end < today) {
      db.prepare("UPDATE companies SET status = 'expired' WHERE id = ?").run(s.company_id);
      return res.status(403).json({ error: 'account_expired' });
    }
  }
  req.user = s;
  const userRow = db.prepare('SELECT branch_id FROM users WHERE id = ?').get(s.user_id);
  req.user.branch_id = userRow ? userRow.branch_id : null;
  next();
}

function daysLeft(end) {
  if (!end) return null;
  const endD = new Date(end + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((endD - now) / 864e5);
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

/* ---------------- Numbers ---------------- */
function r2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

/* ---------------- Lookups ---------------- */
const qAccount = db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?');
const qProduct = db.prepare('SELECT * FROM products WHERE id = ? AND company_id = ?');
const qCompany = db.prepare('SELECT * FROM companies WHERE id = ?');
const qRate = db.prepare('SELECT * FROM currencies WHERE company_id = ? AND code = ?');
const qPaid = db.prepare('SELECT COALESCE(SUM(base_amount),0) AS paid FROM payments WHERE invoice_id = ?');

function accountById(id, companyId) { return qAccount.get(id, companyId); }
function productById(id, companyId) { return qProduct.get(id, companyId); }
function companyById(id) { return qCompany.get(id); }
function rateFor(companyId, code) {
  const c = qRate.get(companyId, code);
  return c ? c.rate : 1;
}
function invoicePaidBase(invId) { return qPaid.get(invId).paid; }

/* ---------------- Posting engine ---------------- */

function addLine(entryId, accountId, debit, credit) {
  db.prepare('INSERT INTO journal_lines (entry_id, account_id, debit, credit) VALUES (?,?,?,?)')
    .run(entryId, accountId, r2(debit), r2(credit));
}

function createEntry(companyId, date, memo, reference, source, sourceId, lines) {
  const ins = db.prepare('INSERT INTO journal_entries (company_id, date, memo, reference, source, source_id) VALUES (?,?,?,?,?,?)');
  const info = ins.run(companyId, date, memo, reference, source, sourceId);
  for (const l of lines) addLine(info.lastInsertRowid, l.account_id, l.debit || 0, l.credit || 0);
  return info.lastInsertRowid;
}

const getItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');

/** Posts a sales invoice or purchase bill to the ledger + updates inventory. */
function postInvoice(companyId, inv) {
  const items = getItems.all(inv.id);
  const lines = [];
  const coa = {
    ar: '1100', ap: '2100', cash: '1000', tax: '2200',
    revenue: '4000', cogs: '5000', inventory: '1200',
  };
  const acc = (code) => db.prepare('SELECT id FROM accounts WHERE company_id=? AND code=?').get(companyId, code);
  // totals in the company's base currency (per-line currencies already converted)
  const subtotalBase = r2(inv.subtotal_base || inv.subtotal / inv.fx_rate);
  const taxBase = r2(inv.tax_base || inv.tax_amount / inv.fx_rate);
  const totalBase = r2(inv.total_base || inv.total / inv.fx_rate);

  if (inv.kind === 'sale') {
    lines.push({ account_id: acc(coa.ar).id, debit: totalBase, credit: 0 });
    lines.push({ account_id: acc(coa.revenue).id, debit: 0, credit: subtotalBase });
    if (taxBase > 0) lines.push({ account_id: acc(coa.tax).id, debit: 0, credit: taxBase });
    // COGS at average cost (base currency)
    for (const it of items) {
      if (!it.product_id) continue;
      const p = productById(it.product_id, companyId);
      const cogs = p.cost * it.qty;
      lines.push({ account_id: acc(coa.cogs).id, debit: cogs, credit: 0 });
      lines.push({ account_id: acc(coa.inventory).id, debit: 0, credit: cogs });
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(it.qty, p.id);
      db.prepare('INSERT INTO stock_moves (company_id, product_id, date, qty, ref_type, ref_id, unit_cost) VALUES (?,?,?,?,?,?,?)')
        .run(companyId, p.id, inv.date, -it.qty, 'invoice', inv.id, p.cost);
    }
  } else { // purchase
    for (const it of items) {
      const lineFx = it.fx_rate || inv.fx_rate || 1;
      const baseUnit = it.unit_price / lineFx; // unit price in line currency -> base
      if (it.product_id) {
        const p = productById(it.product_id, companyId);
        const newStock = p.stock + it.qty;
        const newCost = newStock > 0 ? (p.stock * p.cost + it.qty * baseUnit) / newStock : baseUnit;
        db.prepare('UPDATE products SET stock = ?, cost = ? WHERE id = ?').run(newStock, r2(newCost), p.id);
        db.prepare('INSERT INTO stock_moves (company_id, product_id, date, qty, ref_type, ref_id, unit_cost) VALUES (?,?,?,?,?,?,?)')
          .run(companyId, p.id, inv.date, it.qty, 'bill', inv.id, r2(baseUnit));
      }
    }
    lines.push({ account_id: acc(coa.ap).id, debit: 0, credit: totalBase });
    lines.push({ account_id: acc(coa.inventory).id, debit: subtotalBase, credit: 0 });
    if (taxBase > 0) lines.push({ account_id: acc(coa.tax).id, debit: taxBase, credit: 0 });
  }

  db.prepare('UPDATE invoices SET status = ?, posted_at = ? WHERE id = ?')
    .run('posted', new Date().toISOString(), inv.id);
  return createEntry(companyId, inv.date, inv.kind === 'sale' ? 'Sales invoice ' + inv.number : 'Purchase bill ' + inv.number,
    inv.number, inv.kind, inv.id, lines);
}

/** Base-currency total of an invoice (handles legacy rows). */
function baseTotal(inv) { return r2(inv.total_base || inv.total / inv.fx_rate); }

/** Records a payment against a sale invoice or purchase bill. */
function recordPayment(companyId, inv, { date, amount, accountId, memo }) {
  const base = amount / inv.fx_rate;
  db.prepare('INSERT INTO payments (company_id, invoice_id, date, amount, base_amount, account_id, memo) VALUES (?,?,?,?,?,?,?)')
    .run(companyId, inv.id, date, r2(amount), r2(base), accountId, memo || '');
  const lines = inv.kind === 'sale'
    ? [
        { account_id: accountId, debit: base, credit: 0 },
        { account_id: accountByIdByCode(companyId, '1100').id, debit: 0, credit: base },
      ]
    : [
        { account_id: accountByIdByCode(companyId, '2100').id, debit: base, credit: 0 },
        { account_id: accountId, debit: 0, credit: base },
      ];
  createEntry(companyId, date, 'Payment ' + (inv.kind === 'sale' ? 'received ' : 'made ') + inv.number,
    'PAY-' + inv.number, 'payment', inv.id, lines);
  const paid = invoicePaidBase(inv.id);
  const totalBase = inv.total / inv.fx_rate;
  if (paid >= totalBase - 0.005) db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run('paid', inv.id);
}

function accountByIdByCode(companyId, code) {
  return db.prepare('SELECT id FROM accounts WHERE company_id=? AND code=?').get(companyId, code);
}

/* ---------------- Serializers ---------------- */
function nextNumber(companyId, prefix) {
  const row = db.prepare(`SELECT number FROM invoices WHERE company_id = ? AND number LIKE ? ORDER BY number DESC LIMIT 1`)
    .get(companyId, prefix + '-%');
  let n = 0;
  if (row) { const m = row.number.match(/(\d+)$/); if (m) n = parseInt(m[1], 10); }
  return prefix + '-' + String(n + 1).padStart(4, '0');
}

function getBranchCtx(req) {
  const userBid = req.user.branch_id;
  if (userBid) return { bid: Number(userBid) };
  const headerBid = req.headers['x-branch-id'];
  const bid = headerBid ? (Number(headerBid) || null) : null;
  return { bid };
}

function getEffectiveBranchId(req) {
  const { bid } = getBranchCtx(req);
  if (bid) return bid;
  const branch = db.prepare('SELECT id FROM branches WHERE company_id = ? ORDER BY id LIMIT 1').get(req.user.company_id);
  return branch ? branch.id : null;
}

module.exports = {
  db, hashPassword, verifyPassword, newToken, requireAuth, daysLeft, todayISO, r2,
  accountById, productById, companyById, rateFor, invoicePaidBase, baseTotal,
  createEntry, postInvoice, recordPayment, accountByIdByCode, nextNumber,
  getBranchCtx, getEffectiveBranchId
};
