const express = require('express');
const { db, requireAuth, r2, createEntry } = require('../lib');

const router = express.Router();
router.use(requireAuth);

/* ================= Chart of Accounts ================= */
router.get('/accounts', (req, res) => {
  const rows = db.prepare('SELECT * FROM accounts WHERE company_id = ? ORDER BY code').all(req.user.company_id);
  res.json({ accounts: rows });
});

router.post('/accounts', (req, res) => {
  const { code, name, name_ar, type } = req.body || {};
  if (!code || !name || !type) return res.status(400).json({ error: 'missing_fields' });
  const exists = db.prepare('SELECT id FROM accounts WHERE company_id = ? AND code = ?').get(req.user.company_id, code);
  if (exists) return res.status(400).json({ error: 'code_taken' });
  const info = db.prepare('INSERT INTO accounts (company_id, code, name, name_ar, type) VALUES (?,?,?,?,?)')
    .run(req.user.company_id, code, name, name_ar || '', type);
  res.json({ account: db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid) });
});

router.put('/accounts/:id', (req, res) => {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  const { name, name_ar, is_active } = req.body || {};
  db.prepare('UPDATE accounts SET name = ?, name_ar = ?, is_active = ? WHERE id = ?')
    .run(name ?? acc.name, name_ar ?? acc.name_ar, is_active === undefined ? acc.is_active : (is_active ? 1 : 0), acc.id);
  res.json({ account: db.prepare('SELECT * FROM accounts WHERE id = ?').get(acc.id) });
});

/* ================= Journal Entries ================= */
router.get('/journal', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const rows = db.prepare(`
    SELECT je.*, COUNT(jl.id) AS line_count,
      ROUND(COALESCE(SUM(jl.debit),0),2) AS total_debit,
      ROUND(COALESCE(SUM(jl.credit),0),2) AS total_credit
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON jl.entry_id = je.id
    WHERE je.company_id = ?
    GROUP BY je.id ORDER BY je.date DESC, je.id DESC LIMIT ?`).all(req.user.company_id, limit);
  res.json({ entries: rows });
});

router.get('/journal/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!entry) return res.status(404).json({ error: 'not_found' });
  const lines = db.prepare(`
    SELECT jl.*, a.code, a.name, a.name_ar, a.type
    FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
    WHERE jl.entry_id = ?`).all(entry.id);
  res.json({ entry, lines });
});

router.post('/journal', (req, res) => {
  const { date, memo, lines } = req.body || {};
  if (!date || !Array.isArray(lines) || lines.length < 2) return res.status(400).json({ error: 'invalid_entry' });
  let d = 0, c = 0;
  for (const l of lines) {
    if (!l.account_id) return res.status(400).json({ error: 'invalid_account' });
    const acc = db.prepare('SELECT id FROM accounts WHERE id = ? AND company_id = ?').get(l.account_id, req.user.company_id);
    if (!acc) return res.status(400).json({ error: 'invalid_account' });
    d += Number(l.debit) || 0; c += Number(l.credit) || 0;
  }
  if (Math.abs(r2(d) - r2(c)) > 0.005) return res.status(400).json({ error: 'unbalanced' });
  const n = db.prepare('SELECT COUNT(*) AS n FROM journal_entries WHERE company_id = ? AND source = ?')
    .get(req.user.company_id, 'manual').n + 1;
  const id = createEntry(req.user.company_id, date, memo || '', 'JE-' + String(n).padStart(4, '0'), 'manual', 0,
    lines.map(l => ({ account_id: l.account_id, debit: l.debit || 0, credit: l.credit || 0 })));
  res.json({ entry: db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id) });
});

router.delete('/journal/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ? AND company_id = ?').get(req.params.id, req.user.company_id);
  if (!entry) return res.status(404).json({ error: 'not_found' });
  if (entry.source !== 'manual') return res.status(400).json({ error: 'system_entry' });
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(entry.id);
  res.json({ ok: true });
});

/* ================= General Ledger ================= */
router.get('/ledger', (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND company_id = ?').get(req.query.account_id, req.user.company_id);
  if (!account) return res.status(404).json({ error: 'not_found' });
  const rows = db.prepare(`
    SELECT je.date, je.memo, je.reference, je.source, jl.debit, jl.credit, je.id AS entry_id
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
    WHERE jl.account_id = ? AND je.company_id = ?
    ORDER BY je.date ASC, je.id ASC`).all(account.id, req.user.company_id);
  let bal = 0;
  for (const r of rows) {
    const sign = ['asset', 'expense'].includes(account.type) ? 1 : -1;
    bal = r2(bal + sign * (r.debit - r.credit));
    r.balance = bal;
  }
  res.json({ account, lines: rows.reverse() });
});

/* ================= Trial Balance ================= */
router.get('/trial-balance', (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.code, a.name, a.name_ar, a.type,
      ROUND(COALESCE(SUM(jl.debit),0),2) AS debit,
      ROUND(COALESCE(SUM(jl.credit),0),2) AS credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.entry_id AND je.company_id = ?
    WHERE a.company_id = ?
    GROUP BY a.id ORDER BY a.code`).all(req.user.company_id, req.user.company_id);
  const totals = { debit: 0, credit: 0 };
  for (const r of rows) { totals.debit += r.debit; totals.credit += r.credit; }
  res.json({ rows, totals: { debit: r2(totals.debit), credit: r2(totals.credit) } });
});

/* ================= P&L ================= */
router.get('/pnl', (req, res) => {
  const { from, to } = req.query;
  let base = 'SELECT je.company_id, jl.account_id, a.code, a.name, a.name_ar, a.type, SUM(jl.debit) d, SUM(jl.credit) c FROM journal_lines jl JOIN journal_entries je ON je.id=jl.entry_id JOIN accounts a ON a.id=jl.account_id WHERE je.company_id = ?';
  const params = [req.user.company_id];
  if (from) { base += ' AND je.date >= ?'; params.push(from); }
  if (to) { base += ' AND je.date <= ?'; params.push(to); }
  base += ' GROUP BY jl.account_id';
  const rows = db.prepare(base).all(...params);
  const income = rows.filter(r => r.type === 'income').map(r => ({ ...r, amount: r2(r.c - r.d) }));
  const expense = rows.filter(r => r.type === 'expense').map(r => ({ ...r, amount: r2(r.d - r.c) }));
  const totalIncome = r2(income.reduce((s, r) => s + r.amount, 0));
  const totalExpense = r2(expense.reduce((s, r) => s + r.amount, 0));
  res.json({ income, expense, totalIncome, totalExpense, net: r2(totalIncome - totalExpense) });
});

/* ================= Balance Sheet ================= */
router.get('/balance-sheet', (req, res) => {
  const asof = req.query.asof || new Date().toISOString().slice(0, 10);
  const base = 'SELECT jl.account_id, a.code, a.name, a.name_ar, a.type, SUM(jl.debit) d, SUM(jl.credit) c FROM journal_lines jl JOIN journal_entries je ON je.id=jl.entry_id JOIN accounts a ON a.id=jl.account_id WHERE je.company_id = ? AND je.date <= ? GROUP BY jl.account_id';
  const rows = db.prepare(base).all(req.user.company_id, asof);
  const byType = (t) => rows.filter(r => r.type === t)
    .map(r => ({ code: r.code, name: r.name, name_ar: r.name_ar, amount: r2(t === 'asset' || t === 'expense' ? r.d - r.c : r.c - r.d) }));
  const assets = byType('asset');
  const liabilities = byType('liability');
  const equityRaw = byType('equity');
  const netIncome = r2(
    rows.filter(r => r.type === 'income').reduce((s, r) => s + (r.c - r.d), 0) -
    rows.filter(r => r.type === 'expense').reduce((s, r) => s + (r.d - r.c), 0)
  );
  const equity = [...equityRaw, { code: '', name: 'Retained Earnings (Net Income)', name_ar: 'الأرباح المحتجزة (صافي الدخل)', amount: netIncome, isRetained: true }];
  const totalAssets = r2(assets.reduce((s, r) => s + r.amount, 0));
  const totalLiab = r2(liabilities.reduce((s, r) => s + r.amount, 0));
  const totalEquity = r2(equity.reduce((s, r) => s + r.amount, 0));
  res.json({ asof, assets, liabilities, equity, totalAssets, totalLiab, totalEquity, totalLiabEquity: r2(totalLiab + totalEquity) });
});

/* ================= Dashboard ================= */
router.get('/dashboard', (req, res) => {
  const cid = req.user.company_id;
  const kpi = (sql, ...p) => db.prepare(sql).get(cid, ...p);

  const revenue = kpi(`SELECT ROUND(COALESCE(SUM(COALESCE(subtotal_base, subtotal / fx_rate)),0),2) v FROM invoices WHERE company_id=? AND kind='sale' AND status != 'draft'`);
  const expenses = kpi(`SELECT ROUND(COALESCE((
      SELECT SUM(COALESCE(total_base, total / fx_rate)) FROM invoices WHERE company_id=? AND kind='purchase' AND status != 'draft'
    ) + (SELECT SUM(base_amount) FROM expenses WHERE company_id=?),0),2) v`, cid);
  const ar = kpi(`SELECT ROUND(COALESCE(SUM(total / fx_rate - COALESCE((SELECT SUM(base_amount) FROM payments p WHERE p.invoice_id = i.id),0)),0),2) v
    FROM invoices i WHERE i.company_id=? AND i.kind='sale' AND i.status IN ('posted','paid') AND i.status != 'draft'`);
  const ap = kpi(`SELECT ROUND(COALESCE(SUM(total / fx_rate - COALESCE((SELECT SUM(base_amount) FROM payments p WHERE p.invoice_id = i.id),0)),0),2) v
    FROM invoices i WHERE i.company_id=? AND i.kind='purchase' AND i.status IN ('posted','paid')`);
  const cash = kpi(`SELECT ROUND(COALESCE(SUM(jl.debit - jl.credit),0),2) v FROM journal_lines jl JOIN journal_entries je ON je.id=jl.entry_id JOIN accounts a ON a.id=jl.account_id
    WHERE je.company_id=? AND a.code LIKE '10%'`);
  const invValue = kpi(`SELECT ROUND(COALESCE(SUM(stock * cost),0),2) v FROM products WHERE company_id=?`);
  const lowStock = db.prepare('SELECT COUNT(*) n FROM products WHERE company_id=? AND stock <= reorder_level').get(cid).n;
  const custCount = db.prepare('SELECT COUNT(*) n FROM contacts WHERE company_id=? AND kind=?').get(cid, 'customer').n;
  const supCount = db.prepare('SELECT COUNT(*) n FROM contacts WHERE company_id=? AND kind=?').get(cid, 'supplier').n;
  const prodCount = db.prepare('SELECT COUNT(*) n FROM products WHERE company_id=?').get(cid).n;

  // monthly revenue vs expenses for the last 6 months
  const months = [];
  const lang = req.query.lang === 'ar' ? 'ar' : 'en';
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    months.push({ key, label: d.toLocaleDateString(lang, { month: 'short', year: '2-digit' }) });
  }
  const revRows = db.prepare(`SELECT strftime('%Y-%m', date) m, SUM(COALESCE(subtotal_base, subtotal / fx_rate)) v FROM invoices WHERE company_id=? AND kind='sale' AND status != 'draft' GROUP BY m`).all(cid);
  const expRows = db.prepare(`SELECT m, SUM(v) v FROM (
      SELECT strftime('%Y-%m', date) m, SUM(COALESCE(total_base, total / fx_rate)) v FROM invoices WHERE company_id=? AND kind='purchase' AND status != 'draft' GROUP BY m
      UNION ALL
      SELECT strftime('%Y-%m', date) m, SUM(base_amount) v FROM expenses WHERE company_id=? GROUP BY m) GROUP BY m`).all(cid, cid);
  const revMap = Object.fromEntries(revRows.map(r => [r.m, r.v]));
  const expMap = Object.fromEntries(expRows.map(r => [r.m, r.v]));
  for (const m of months) { m.revenue = r2(revMap[m.key] || 0); m.expense = r2(expMap[m.key] || 0); }

  const recentInvoices = db.prepare(`
    SELECT i.number, i.date, i.total, i.fx_rate, i.status, i.currency, c.name AS contact_name, i.kind
    FROM invoices i LEFT JOIN contacts c ON c.id = i.contact_id
    WHERE i.company_id = ? AND i.status != 'draft'
    ORDER BY i.date DESC, i.id DESC LIMIT 8`).all(cid);
  const lowStockProducts = db.prepare('SELECT * FROM products WHERE company_id=? AND stock <= reorder_level ORDER BY stock ASC LIMIT 6').all(cid);

  res.json({
    kpis: { revenue: revenue.v, expenses: expenses.v, net: r2(revenue.v - expenses.v), ar: ar.v, ap: ap.v, cash: cash.v, invValue: invValue.v, lowStock, custCount, supCount, prodCount },
    months, recentInvoices, lowStockProducts,
  });
});

module.exports = router;
