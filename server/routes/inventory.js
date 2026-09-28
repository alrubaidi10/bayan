const express = require('express');
const { db, requireAuth, r2, getBranchCtx, getEffectiveBranchId, productById } = require('../lib');
const { triggerAutoSync } = require('../firebase');

const router = express.Router();
router.use(requireAuth);

/* ============ 1. On-Hand Inventory (المخزون الفعلي) ============ */
router.get('/on-hand', (req, res) => {
  const cid = req.user.company_id;
  const { bid } = getBranchCtx(req);

  // Filters from query
  const q = (req.query.q || '').trim().toLowerCase();
  const filterProdId = req.query.product_id ? Number(req.query.product_id) : null;
  const filterBranchId = req.query.branch_id ? Number(req.query.branch_id) : bid;
  const filterSn = (req.query.serial_number || '').trim().toLowerCase();
  const filterBatch = (req.query.batch_number || '').trim().toLowerCase();
  const filterCondition = (req.query.condition || '').trim();
  const filterStatus = (req.query.status || '').trim();
  const filterColor = (req.query.color || '').trim();
  const filterStorage = (req.query.storage || '').trim();
  const hideZero = req.query.hide_zero === '1' || req.query.hide_zero === 'true';

  let sql = `
    SELECT 
      ps.*,
      p.name AS product_name,
      p.name_ar AS product_name_ar,
      p.sku AS product_sku,
      p.category AS product_category,
      p.brand AS product_brand,
      p.model AS product_model,
      p.unit AS product_unit,
      p.cost AS product_default_cost,
      p.price AS product_default_price,
      p.stock AS product_total_stock,
      b.name AS branch_name,
      b.code AS branch_code
    FROM product_serials ps
    JOIN products p ON p.id = ps.product_id
    LEFT JOIN branches b ON b.id = ps.branch_id
    WHERE ps.company_id = ?
  `;
  const params = [cid];

  if (filterBranchId) {
    sql += ` AND ps.branch_id = ?`;
    params.push(filterBranchId);
  }
  if (filterProdId) {
    sql += ` AND ps.product_id = ?`;
    params.push(filterProdId);
  }
  if (filterCondition) {
    sql += ` AND ps.condition = ?`;
    params.push(filterCondition);
  }
  if (filterStatus) {
    sql += ` AND ps.status = ?`;
    params.push(filterStatus);
  }
  if (filterColor) {
    sql += ` AND ps.color = ?`;
    params.push(filterColor);
  }
  if (filterStorage) {
    sql += ` AND ps.storage = ?`;
    params.push(filterStorage);
  }
  if (filterBatch) {
    sql += ` AND LOWER(ps.batch_number) LIKE ?`;
    params.push(`%${filterBatch}%`);
  }
  if (filterSn) {
    sql += ` AND (LOWER(ps.serial_number) LIKE ? OR LOWER(ps.serial_number_2) LIKE ?)`;
    params.push(`%${filterSn}%`, `%${filterSn}%`);
  }

  sql += ` ORDER BY ps.id DESC`;

  let rows = db.prepare(sql).all(...params);

  // Apply general search if present
  if (q) {
    rows = rows.filter(r => {
      const searchBlob = [
        r.product_name,
        r.product_name_ar,
        r.product_sku,
        r.serial_number,
        r.serial_number_2,
        r.batch_number,
        r.color,
        r.storage,
        r.ram,
        r.shelf_location,
        r.branch_name,
        r.condition,
        r.status
      ].filter(Boolean).join(' ').toLowerCase();
      return searchBlob.includes(q);
    });
  }

  // Format quantities for On-Hand display (like Dynamics 365)
  const items = rows.map(r => {
    const isAvail = r.status === 'available';
    const isReserved = r.status === 'reserved';
    return {
      ...r,
      specs: [r.ram ? `${r.ram} RAM` : '', r.storage ? `${r.storage} ROM` : '', r.color].filter(Boolean).join(' '),
      physical_qty: 1.0,
      reserved_qty: isReserved ? 1.0 : 0.0,
      available_qty: isAvail ? 1.0 : 0.0,
      on_order_qty: 0.0,
      is_available: isAvail,
    };
  });

  const finalItems = hideZero ? items.filter(it => it.available_qty > 0) : items;

  // Master lists for filters and dimension selects
  const bSql = bid ? 'AND branch_id = ?' : '';
  const bP = bid ? [bid] : [];
  const products = db.prepare(`SELECT * FROM products WHERE company_id = ? ${bSql} ORDER BY name`).all(cid, ...bP);
  const branches = db.prepare(`SELECT * FROM branches WHERE company_id = ? ORDER BY id`).all(cid);

  const colors = [...new Set(items.map(i => i.color).filter(Boolean))].sort();
  const storages = [...new Set(items.map(i => i.storage).filter(Boolean))].sort();
  const conditions = ['new', 'demo', 'used', 'refurbished', 'maintenance'];

  // Overall KPIs
  const totalPhysical = items.reduce((s, it) => s + it.physical_qty, 0);
  const totalAvailable = items.reduce((s, it) => s + it.available_qty, 0);
  const totalReserved = items.reduce((s, it) => s + it.reserved_qty, 0);
  const totalCostValue = r2(items.filter(it => it.is_available).reduce((s, it) => s + (it.cost || it.product_default_cost || 0), 0));
  const demoCount = items.filter(it => it.condition === 'demo' && it.is_available).length;

  res.json({
    items: finalItems,
    products,
    branches,
    filter_options: {
      colors,
      storages,
      conditions,
      categories: [...new Set(products.map(p => p.category).filter(Boolean))].sort(),
      brands: [...new Set(products.map(p => p.brand).filter(Boolean))].sort(),
    },
    totals: {
      totalPhysical,
      totalAvailable,
      totalReserved,
      totalCostValue,
      demoCount,
      uniqueSkus: [...new Set(items.map(i => i.product_id))].length
    }
  });
});

/* ============ 2. Bulk IMEI / Serial Receipt (استلام دفعة أجهزة بالسكانر) ============ */
router.post('/serials/bulk', (req, res) => {
  const cid = req.user.company_id;
  const {
    product_id,
    branch_id,
    serials, // array of strings OR newline-separated string
    serial_list, // alias
    storage,
    ram,
    color,
    shelf_location,
    condition = 'new',
    cost,
    price,
    batch_number,
    warranty_months = 24,
    notes = ''
  } = req.body || {};

  const p = productById(product_id, cid);
  if (!p) return res.status(404).json({ error: 'product_not_found' });

  const effectiveBid = branch_id ? Number(branch_id) : (getEffectiveBranchId(req) || p.branch_id);
  if (!effectiveBid) return res.status(400).json({ error: 'no_branch_selected' });

  // Parse raw serials
  let snArray = [];
  const rawInput = serials || serial_list || '';
  if (Array.isArray(rawInput)) {
    snArray = rawInput.map(s => String(s).trim()).filter(Boolean);
  } else if (typeof rawInput === 'string') {
    snArray = rawInput
      .split(/[\r\n,;\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  if (snArray.length === 0) {
    return res.status(400).json({ error: 'no_serials_provided' });
  }

  // Deduplicate input array
  snArray = [...new Set(snArray)];

  // Check for existing serial numbers in this company
  const placeholders = snArray.map(() => '?').join(',');
  const existingRows = db.prepare(
    `SELECT serial_number FROM product_serials WHERE company_id = ? AND serial_number IN (${placeholders})`
  ).all(cid, ...snArray);

  if (existingRows.length > 0) {
    const dups = existingRows.map(r => r.serial_number);
    return res.status(400).json({
      error: 'duplicate_serials_exist',
      duplicates: dups,
      message: `الأرقام التسلسلية التالية مسجلة مسبقاً: ${dups.slice(0, 5).join(', ')}${dups.length > 5 ? ` و ${dups.length - 5} أخرى...` : ''}`
    });
  }

  const unitCost = cost !== undefined && cost !== null && cost !== '' ? Number(cost) : p.cost;
  const unitPrice = price !== undefined && price !== null && price !== '' ? Number(price) : p.price;
  const itemColor = color || p.color || '';
  const itemStorage = storage || p.storage || '';
  const itemRam = ram || p.ram || '';
  const itemShelf = shelf_location || '';
  const itemBatch = batch_number || '';

  const insertStmt = db.prepare(`
    INSERT INTO product_serials (
      company_id, branch_id, product_id, serial_number, batch_number,
      storage, ram, color, shelf_location, condition, status,
      cost, price, warranty_months, notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertTx = db.transaction(() => {
    for (const sn of snArray) {
      insertStmt.run(
        cid,
        effectiveBid,
        p.id,
        sn,
        itemBatch,
        itemStorage,
        itemRam,
        itemColor,
        itemShelf,
        condition,
        'available',
        unitCost,
        unitPrice,
        Number(warranty_months) || 24,
        notes
      );
    }

    // Increment product stock
    db.prepare('UPDATE products SET stock = ROUND(stock + ?, 4) WHERE id = ?').run(snArray.length, p.id);

    // Record stock move
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO stock_moves (company_id, branch_id, product_id, date, qty, ref_type, ref_id, unit_cost)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(cid, effectiveBid, p.id, today, snArray.length, 'serial_bulk_in', 0, unitCost);
  });

  insertTx();
  triggerAutoSync(cid);

  const updatedProduct = productById(p.id, cid);
  res.json({
    success: true,
    added_count: snArray.length,
    product: updatedProduct,
    serials: snArray
  });
});

/* ============ 3. IMEI / Serial Quick Warranty & History Lookup ============ */
router.get('/serials/lookup/:sn', (req, res) => {
  const cid = req.user.company_id;
  const querySn = req.params.sn.trim();

  const serial = db.prepare(`
    SELECT 
      ps.*,
      p.name AS product_name,
      p.name_ar AS product_name_ar,
      p.sku AS product_sku,
      p.category AS product_category,
      p.brand AS product_brand,
      p.model AS product_model,
      b.name AS branch_name,
      b.code AS branch_code,
      i.number AS invoice_number,
      i.date AS invoice_date,
      c.name AS customer_name,
      c.phone AS customer_phone
    FROM product_serials ps
    JOIN products p ON p.id = ps.product_id
    LEFT JOIN branches b ON b.id = ps.branch_id
    LEFT JOIN invoices i ON i.id = ps.invoice_id
    LEFT JOIN contacts c ON c.id = i.contact_id
    WHERE ps.company_id = ? AND (ps.serial_number = ? OR ps.serial_number_2 = ?)
  `).get(cid, querySn, querySn);

  if (!serial) return res.status(404).json({ error: 'serial_not_found' });

  // Calculate warranty status
  let warranty = { status: 'active', remaining_days: 0, expiry_date: null };
  const startDateStr = serial.sold_at || serial.invoice_date || serial.created_at;
  if (startDateStr && serial.warranty_months > 0) {
    const start = new Date(startDateStr);
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + serial.warranty_months);
    const today = new Date();
    const remainingMs = expiry.getTime() - today.getTime();
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    warranty = {
      status: remainingDays > 0 ? 'active' : 'expired',
      remaining_days: Math.max(0, remainingDays),
      expiry_date: expiry.toISOString().slice(0, 10),
      start_date: startDateStr.slice(0, 10)
    };
  }

  res.json({ serial, warranty });
});

/* ============ 4. Update Serial Details (Shelf, Condition, Status) ============ */
router.put('/serials/:id', (req, res) => {
  const cid = req.user.company_id;
  const serial = db.prepare('SELECT * FROM product_serials WHERE id = ? AND company_id = ?').get(req.params.id, cid);
  if (!serial) return res.status(404).json({ error: 'not_found' });

  const { condition, shelf_location, branch_id, status, notes, price, cost } = req.body || {};

  db.prepare(`
    UPDATE product_serials SET
      condition = COALESCE(?, condition),
      shelf_location = COALESCE(?, shelf_location),
      branch_id = COALESCE(?, branch_id),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes),
      price = COALESCE(?, price),
      cost = COALESCE(?, cost)
    WHERE id = ? AND company_id = ?
  `).run(
    condition !== undefined ? condition : null,
    shelf_location !== undefined ? shelf_location : null,
    branch_id !== undefined ? Number(branch_id) : null,
    status !== undefined ? status : null,
    notes !== undefined ? notes : null,
    price !== undefined ? Number(price) : null,
    cost !== undefined ? Number(cost) : null,
    serial.id,
    cid
  );

  triggerAutoSync(cid);
  const updated = db.prepare('SELECT * FROM product_serials WHERE id = ?').get(serial.id);
  res.json({ serial: updated });
});

/* ============ 5. Delete Serial (Only if available) ============ */
router.delete('/serials/:id', (req, res) => {
  const cid = req.user.company_id;
  const serial = db.prepare('SELECT * FROM product_serials WHERE id = ? AND company_id = ?').get(req.params.id, cid);
  if (!serial) return res.status(404).json({ error: 'not_found' });

  if (serial.status === 'sold') {
    return res.status(400).json({ error: 'cannot_delete_sold_serial', message: 'لا يمكن حذف جهاز تم بيعه بالفعل ومسجل في فاتورة' });
  }

  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM product_serials WHERE id = ?').run(serial.id);
    db.prepare('UPDATE products SET stock = MAX(0, ROUND(stock - 1, 4)) WHERE id = ?').run(serial.product_id);
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO stock_moves (company_id, branch_id, product_id, date, qty, ref_type, ref_id, unit_cost)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(cid, serial.branch_id, serial.product_id, today, -1, 'serial_delete', serial.id, serial.cost);
  });

  deleteTx();
  triggerAutoSync(cid);
  res.json({ ok: true, deleted_id: serial.id });
});

/* ============ 6. Seed Realistic Phone Data if none exist ============ */
router.post('/seed-telecom-samples', (req, res) => {
  const cid = req.user.company_id;
  const { bid } = getBranchCtx(req);
  const effectiveBid = bid || getEffectiveBranchId(req);

  const existingCount = db.prepare('SELECT COUNT(*) n FROM product_serials WHERE company_id = ?').get(cid).n;
  if (existingCount > 0) {
    return res.json({ message: 'already_seeded', count: existingCount });
  }

  const phones = [
    {
      name: 'Huawei Nova 14i 8+256 Blue DEMO',
      name_ar: 'هواوي نوفا 14i ذاكرة 256 جيجا أزرق (ديمو)',
      sku: 'HU-N14i-8-256-BU07',
      brand: 'Huawei',
      model: 'Nova 14i',
      category: 'جوالات',
      cost: 750,
      price: 999,
      storage: '256GB',
      ram: '8GB',
      color: 'Blue',
      shelf: 'A-01',
      condition: 'demo',
      serials: ['8636110871082364', '8636110871085466']
    },
    {
      name: 'Huawei Nova 15 Max 8+256 Golden Black',
      name_ar: 'هواوي نوفا 15 ماكس 256 جيجا أسود ذهبي',
      sku: 'HU-N15M-8-256-BK08',
      brand: 'Huawei',
      model: 'Nova 15 Max',
      category: 'جوالات',
      cost: 1100,
      price: 1499,
      storage: '256GB',
      ram: '8GB',
      color: 'Golden Black',
      shelf: 'A-02',
      condition: 'new',
      serials: [
        '863611084845791',
        '863611084846674',
        '863611084858901',
        '863611084866060',
        '863611085238566',
        '863611085239028',
        '863611085240596',
        '863611085240612',
        '863611085245173',
        '863611085252039',
        '863611085258671',
        '863611085258861',
        '863611085258952',
        '863611085264273'
      ]
    },
    {
      name: 'iPhone 16 Pro Max 256GB Natural Titanium',
      name_ar: 'آيفون 16 برو ماكس 256 جيجا تيتانيوم طبيعي',
      sku: 'AP-IP16PM-256-NT',
      brand: 'Apple',
      model: 'iPhone 16 Pro Max',
      category: 'جوالات',
      cost: 4100,
      price: 4799,
      storage: '256GB',
      ram: '8GB',
      color: 'Natural Titanium',
      shelf: 'VIP-01',
      condition: 'new',
      serials: ['354890123456781', '354890123456782', '354890123456783']
    },
    {
      name: 'Samsung Galaxy S25 Ultra 512GB Titanium Gray',
      name_ar: 'سامسونج جالاكسي S25 الترا 512 جيجا رمادي تيتانيوم',
      sku: 'SM-S25U-512-TG',
      brand: 'Samsung',
      model: 'Galaxy S25 Ultra',
      category: 'جوالات',
      cost: 3950,
      price: 4599,
      storage: '512GB',
      ram: '12GB',
      color: 'Titanium Gray',
      shelf: 'VIP-02',
      condition: 'new',
      serials: ['359871129845610', '359871129845611']
    }
  ];

  let addedSerialsTotal = 0;

  const seedTx = db.transaction(() => {
    for (const ph of phones) {
      let prod = db.prepare('SELECT * FROM products WHERE company_id = ? AND sku = ?').get(cid, ph.sku);
      let prodId;
      if (!prod) {
        const pInfo = db.prepare(`
          INSERT INTO products (
            company_id, branch_id, name, name_ar, sku, category,
            brand, model, storage, ram, color, unit, cost, price, stock, reorder_level
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          cid, effectiveBid, ph.name, ph.name_ar, ph.sku, ph.category,
          ph.brand, ph.model, ph.storage, ph.ram, ph.color, 'pcs',
          ph.cost, ph.price, ph.serials.length, 5
        );
        prodId = pInfo.lastInsertRowid;
      } else {
        prodId = prod.id;
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(ph.serials.length, prodId);
      }

      for (const sn of ph.serials) {
        db.prepare(`
          INSERT INTO product_serials (
            company_id, branch_id, product_id, serial_number,
            storage, ram, color, shelf_location, condition, status,
            cost, price, warranty_months
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          cid, effectiveBid, prodId, sn,
          ph.storage, ph.ram, ph.color, ph.shelf, ph.condition, 'available',
          ph.cost, ph.price, 24
        );
        addedSerialsTotal++;
      }
    }
  });

  seedTx();
  triggerAutoSync(cid);

  res.json({ success: true, seeded_devices: addedSerialsTotal });
});

module.exports = router;
