const express = require('express');
const { db, requireAuth, r2, productById } = require('../lib');

const router = express.Router();
router.use(requireAuth);

/* ============ Stock Transfers ============ */
function nextTransferNumber(cid) {
  const row = db.prepare("SELECT number FROM stock_transfers WHERE company_id = ? ORDER BY id DESC LIMIT 1").get(cid);
  let n = 0;
  if (row) { const m = row.number.match(/(\d+)$/); if (m) n = parseInt(m[1], 10); }
  return 'TRF-' + String(n + 1).padStart(4, '0');
}

router.get('/', (req, res) => {
  const cid = req.user.company_id;
  const transfers = db.prepare('SELECT * FROM stock_transfers WHERE company_id = ? ORDER BY date DESC, id DESC').all(cid);
  res.json({ transfers });
});

router.get('/:id', (req, res) => {
  const cid = req.user.company_id;
  const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ? AND company_id = ?').get(req.params.id, cid);
  if (!transfer) return res.status(404).json({ error: 'not_found' });
  const items = db.prepare(`
    SELECT sti.*, p.name, p.name_ar, p.unit, p.stock
    FROM stock_transfer_items sti
    JOIN products p ON p.id = sti.product_id
    WHERE sti.transfer_id = ?
  `).all(transfer.id);
  res.json({ transfer, items });
});

router.post('/', (req, res) => {
  const cid = req.user.company_id;
  const { date, from_location, to_location, memo, items } = req.body || {};
  if (!date || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'missing_fields' });
  const number = nextTransferNumber(cid);
  const info = db.prepare('INSERT INTO stock_transfers (company_id, number, date, from_location, to_location, memo, status) VALUES (?,?,?,?,?,?,?)')
    .run(cid, number, date, from_location || 'المستودع الرئيسي', to_location || 'فرع', memo || '', 'draft');
  const tid = info.lastInsertRowid;
  const insItem = db.prepare('INSERT INTO stock_transfer_items (transfer_id, product_id, qty, unit_cost) VALUES (?,?,?,?)');
  for (const it of items) {
    const p = productById(it.product_id, cid);
    if (!p) continue;
    insItem.run(tid, p.id, Number(it.qty) || 0, Number(it.unit_cost) || p.cost);
  }
  const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(tid);
  const transferItems = db.prepare('SELECT sti.*, p.name, p.name_ar, p.unit FROM stock_transfer_items sti JOIN products p ON p.id = sti.product_id WHERE sti.transfer_id = ?').all(tid);
  res.json({ transfer, items: transferItems });
});

router.post('/:id/confirm', (req, res) => {
  const cid = req.user.company_id;
  const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ? AND company_id = ?').get(req.params.id, cid);
  if (!transfer) return res.status(404).json({ error: 'not_found' });
  if (transfer.status === 'confirmed') return res.status(400).json({ error: 'already_confirmed' });
  const items = db.prepare('SELECT * FROM stock_transfer_items WHERE transfer_id = ?').all(transfer.id);
  // Apply stock movements — stock goes from warehouse (decrease then increase is conceptual,
  // but since single warehouse, we just log the transfer as a stock_move with ref_type='transfer'
  for (const it of items) {
    const p = productById(it.product_id, cid);
    if (!p) continue;
    // Record as a stock move (net zero for single warehouse, but tracked)
    db.prepare('INSERT INTO stock_moves (company_id, product_id, date, qty, ref_type, ref_id, unit_cost) VALUES (?,?,?,?,?,?,?)')
      .run(cid, p.id, transfer.date, 0, 'transfer', transfer.id, it.unit_cost);
  }
  db.prepare("UPDATE stock_transfers SET status = 'confirmed' WHERE id = ?").run(transfer.id);
  res.json({ transfer: db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(transfer.id) });
});

router.delete('/:id', (req, res) => {
  const cid = req.user.company_id;
  const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ? AND company_id = ?').get(req.params.id, cid);
  if (!transfer) return res.status(404).json({ error: 'not_found' });
  if (transfer.status === 'confirmed') return res.status(400).json({ error: 'already_confirmed' });
  db.prepare('DELETE FROM stock_transfers WHERE id = ?').run(transfer.id);
  res.json({ ok: true });
});

module.exports = router;
