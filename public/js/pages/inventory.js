/* Inventory / Products — full inventory management with manual stock adjustments */
const InventoryPage = {
  title: () => t('nav_inventory'),
  async render(view) {
    const self = this;
    const { products, categories, totalValue, totalItems, lowStockCount, outOfStock } = await api('/inventory/summary');
    const bc = App.me.company.base_currency;
    const low = products.filter(p => p.low);

    view.innerHTML = `
      <!-- KPI Cards -->
      <div class="kpi-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:18px">
        <div class="kpi-card" style="background:var(--card);border-radius:12px;padding:18px 20px;box-shadow:var(--shadow-sm)">
          <div class="kpi-label" style="font-size:.78rem;color:var(--muted);margin-bottom:6px">${esc(t('kpi_products'))}</div>
          <div class="kpi-val" style="font-size:1.6rem;font-weight:700">${fmtNum(totalItems, 0)}</div>
        </div>
        <div class="kpi-card" style="background:var(--card);border-radius:12px;padding:18px 20px;box-shadow:var(--shadow-sm)">
          <div class="kpi-label" style="font-size:.78rem;color:var(--muted);margin-bottom:6px">${esc(t('kpi_invValue'))}</div>
          <div class="kpi-val" style="font-size:1.6rem;font-weight:700;color:var(--primary)">${fmtMoney(totalValue, bc)}</div>
        </div>
        <div class="kpi-card" style="background:var(--card);border-radius:12px;padding:18px 20px;box-shadow:var(--shadow-sm)">
          <div class="kpi-label" style="font-size:.78rem;color:var(--muted);margin-bottom:6px">${esc(t('inv_low_stock_items'))}</div>
          <div class="kpi-val" style="font-size:1.6rem;font-weight:700;color:${lowStockCount > 0 ? 'var(--danger)' : 'var(--success)'}">${fmtNum(lowStockCount, 0)}</div>
        </div>
        <div class="kpi-card" style="background:var(--card);border-radius:12px;padding:18px 20px;box-shadow:var(--shadow-sm)">
          <div class="kpi-label" style="font-size:.78rem;color:var(--muted);margin-bottom:6px">${esc(t('inv_out_of_stock'))}</div>
          <div class="kpi-val" style="font-size:1.6rem;font-weight:700;color:${outOfStock > 0 ? 'var(--danger)' : 'var(--muted)'}">${fmtNum(outOfStock, 0)}</div>
        </div>
      </div>

      <!-- Products Table Card -->
      <div class="card">
        <div class="card-head">
          <div>
            <h3>${esc(t('nav_products'))}</h3>
          </div>
          <div class="spacer"></div>
          <div class="field" style="min-width:180px"><input id="p-search" placeholder="${esc(t('prod_search'))}"></div>
          <div class="field" style="min-width:150px">
            <select id="p-cat"><option value="">${esc(t('prod_all_categories'))}</option>
              ${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="min-width:130px">
            <select id="p-stock-filter">
              <option value="">${esc(t('inv_filter_all'))}</option>
              <option value="low">${esc(t('inv_filter_low'))}</option>
              <option value="out">${esc(t('inv_filter_out'))}</option>
              <option value="ok">${esc(t('inv_filter_ok'))}</option>
            </select>
          </div>
          <button class="btn primary" id="new-prod">${icon('plus')} ${esc(t('inv_new_product'))}</button>
          <button class="btn ghost" id="new-move" style="white-space:nowrap">${icon('layers')} ${esc(t('inv_add_move'))}</button>
        </div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr>
            <th>${esc(t('name'))}</th>
            <th>${esc(t('prod_category'))}</th>
            <th class="mono">${esc(t('inv_sku'))}</th>
            <th>${esc(t('unit'))}</th>
            <th class="num">${esc(t('inv_cost'))}</th>
            <th class="num">${esc(t('inv_price'))}</th>
            <th class="num">${esc(t('stock'))}</th>
            <th class="num">${esc(t('inv_reorder'))}</th>
            <th class="num">${esc(t('inv_value'))}</th>
            <th>${esc(t('status'))}</th>
            <th style="text-align:end">${esc(t('actions'))}</th>
          </tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
      </div>`;

    const tbody = view.querySelector('#rows');
    const draw = () => {
      const q = view.querySelector('#p-search').value.trim().toLowerCase();
      const cat = view.querySelector('#p-cat').value;
      const sf = view.querySelector('#p-stock-filter').value;
      const list = products.filter(p => {
        if (cat && p.category !== cat) return false;
        if (q && !(p.name + ' ' + (p.name_ar || '') + ' ' + (p.sku || '') + ' ' + (p.category || '') + ' ' + (p.barcode || '')).toLowerCase().includes(q)) return false;
        if (sf === 'low' && !p.low) return false;
        if (sf === 'out' && p.stock > 0) return false;
        if (sf === 'ok' && (p.low || p.stock <= 0)) return false;
        return true;
      });

      tbody.innerHTML = list.length ? list.map(p => `
        <tr data-id="${p.id}">
          <td><b>${esc(p.name)}</b>${p.name_ar ? `<br><span class="muted small">${esc(p.name_ar)}</span>` : ''}</td>
          <td>${p.category ? `<span class="badge primary">${esc(p.category)}</span>` : '<span class="muted small">—</span>'}</td>
          <td class="mono muted">${esc(p.sku) || '—'}</td>
          <td class="muted">${esc(p.unit)}</td>
          <td class="money">${fmtMoney(p.cost, bc)}</td>
          <td class="money"><b>${fmtMoney(p.price, bc)}</b></td>
          <td class="num">
            <span class="badge ${p.stock <= 0 ? 'red' : p.low ? 'amber' : 'green'}">${fmtNum(p.stock)} ${esc(p.unit)}</span>
          </td>
          <td class="num muted">${fmtNum(p.reorder_level)}</td>
          <td class="money">${fmtMoney(p.value, bc)}</td>
          <td>${p.is_active ? `<span class="badge green">${esc(t('active'))}</span>` : `<span class="badge gray">${esc(t('inactive'))}</span>`}</td>
          <td style="text-align:end;white-space:nowrap">
            <button class="btn sm ghost" data-act="move-in" title="${esc(t('inv_receive'))}">${icon('plus')}</button>
            <button class="btn sm ghost" data-act="move-out" title="${esc(t('inv_issue'))}">${icon('minus')}</button>
            <button class="btn sm ghost" data-act="moves" title="${esc(t('inv_moves'))}">${icon('layers')}</button>
            <button class="btn sm ghost" data-act="edit">${icon('edit')}</button>
          </td>
        </tr>`).join('') : `<tr><td colspan="11">${emptyState(t('noData'))}</td></tr>`;

      tbody.querySelectorAll('tr').forEach(tr => {
        const p = list.find(x => x.id === Number(tr.dataset.id));
        if (!p) return;
        const editBtn = tr.querySelector('[data-act=edit]');
        const movesBtn = tr.querySelector('[data-act=moves]');
        const moveInBtn = tr.querySelector('[data-act=move-in]');
        const moveOutBtn = tr.querySelector('[data-act=move-out]');
        if (editBtn) editBtn.onclick = () => openForm(p);
        if (movesBtn) movesBtn.onclick = () => showMoves(p);
        if (moveInBtn) moveInBtn.onclick = () => openMoveForm(p, 'in');
        if (moveOutBtn) moveOutBtn.onclick = () => openMoveForm(p, 'out');
      });
    };

    view.querySelector('#p-search').oninput = debounce(draw, 200);
    view.querySelector('#p-cat').onchange = draw;
    view.querySelector('#p-stock-filter').onchange = draw;

    /* -------- Add Product Form -------- */
    const openForm = (p) => {
      modal({
        title: p ? t('inv_edit_product') : t('inv_new_product'), wide: true,
        onOpen(body, close) {
          const catList = [...new Set([...(p && p.category ? [p.category] : []), ...categories])].filter(Boolean);
          body.innerHTML = `
            <div class="form-grid">
              <div class="field"><label>${esc(t('name'))} *</label><input id="f-name" value="${esc(p ? p.name : '')}"></div>
              <div class="field"><label>${esc(t('inv_name_ar'))}</label><input id="f-name-ar" value="${esc(p ? p.name_ar : '')}"></div>
              <div class="field"><label>${esc(t('prod_category'))}</label>
                <input id="f-category" list="cat-list" placeholder="${esc(t('prod_cat_ph'))}" value="${esc(p ? p.category : '')}">
                <datalist id="cat-list">${catList.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
              <div class="field"><label>${esc(t('inv_sku'))}</label><input id="f-sku" value="${esc(p ? p.sku : '')}"></div>
              <div class="field"><label>${esc(t('prod_barcode'))}</label><input id="f-barcode" placeholder="${esc(t('prod_barcode_ph'))}" value="${esc(p ? p.barcode : '')}"></div>
              <div class="field"><label>${esc(t('unit'))}</label>
                <select id="f-unit">${['pcs', 'box', 'kg', 'm', 'set', 'pack'].map(u => `<option ${p && p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
              <div class="field"><label>${esc(t('inv_cost'))} (${esc(bc)})</label><input type="number" step="0.01" id="f-cost" value="${p ? p.cost : ''}"></div>
              <div class="field"><label>${esc(t('inv_price'))} (${esc(bc)})</label><input type="number" step="0.01" id="f-price" value="${p ? p.price : ''}"></div>
              <div class="field"><label>${esc(t('inv_stock'))} (${esc(t('qty'))})</label><input type="number" step="0.01" id="f-stock" value="${p ? p.stock : ''}" ${p ? 'disabled' : ''}>
                <span class="hint">${p ? esc(t('inv_cost_hint')) : ''}</span></div>
              <div class="field"><label>${esc(t('inv_reorder'))}</label><input type="number" step="0.01" id="f-reorder" value="${p ? p.reorder_level : ''}"></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
              <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
              <button class="btn primary" id="f-save">${esc(t('save'))}</button>
            </div>`;
          body.querySelector('#f-cancel').onclick = close;
          body.querySelector('#f-save').onclick = async () => {
            const payload = {
              name: body.querySelector('#f-name').value.trim(),
              name_ar: body.querySelector('#f-name-ar').value.trim(),
              category: body.querySelector('#f-category').value.trim(),
              sku: body.querySelector('#f-sku').value.trim(),
              barcode: body.querySelector('#f-barcode').value.trim(),
              unit: body.querySelector('#f-unit').value,
              cost: parseFloat(body.querySelector('#f-cost').value) || 0,
              price: parseFloat(body.querySelector('#f-price').value) || 0,
              stock: parseFloat(body.querySelector('#f-stock').value) || 0,
              reorder_level: parseFloat(body.querySelector('#f-reorder').value) || 0,
            };
            if (!payload.name) return toast(t('err_missing_fields'), 'err');
            try {
              if (p) await api('/products/' + p.id, { method: 'PUT', body: payload });
              else await api('/products', { method: 'POST', body: payload });
              toast(t('toast_saved'));
              close();
              self.render(view);
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
        },
      });
    };

    /* -------- Manual Stock Movement Form -------- */
    const openMoveForm = (p, defaultType) => {
      modal({
        title: `${esc(t('inv_add_move'))} — ${esc(p ? p.name : '')}`,
        onOpen(body, close) {
          const today = new Date().toISOString().slice(0, 10);
          body.innerHTML = `
            <div class="form-grid">
              ${!p ? `<div class="field" style="grid-column:1/-1">
                <label>${esc(t('name'))} *</label>
                <select id="m-product">
                  <option value="">${esc(t('inv_choose_product'))}</option>
                  ${products.map(pr => `<option value="${pr.id}">${esc(pr.name)}</option>`).join('')}
                </select></div>` : ''}
              <div class="field"><label>${esc(t('date'))} *</label><input type="date" id="m-date" value="${today}"></div>
              <div class="field"><label>${esc(t('inv_move_type'))} *</label>
                <select id="m-type">
                  <option value="in" ${defaultType === 'in' ? 'selected' : ''}>${esc(t('inv_receive'))}</option>
                  <option value="out" ${defaultType === 'out' ? 'selected' : ''}>${esc(t('inv_issue'))}</option>
                  <option value="adjust">${esc(t('inv_adjust'))}</option>
                </select></div>
              <div class="field"><label>${esc(t('qty'))} *</label><input type="number" step="0.01" id="m-qty" min="0" placeholder="0"></div>
              <div class="field"><label>${esc(t('inv_unit_cost'))} (${esc(bc)})</label><input type="number" step="0.01" id="m-cost" value="${p ? p.cost : ''}" placeholder="${p ? p.cost : '0'}"></div>
              <div class="field" style="grid-column:1/-1"><label>${esc(t('notes'))}</label><input id="m-memo" placeholder="${esc(t('inv_move_memo_ph'))}"></div>
            </div>
            <div class="form-grid" style="margin-top:10px;padding:12px;background:var(--bg);border-radius:8px">
              ${p ? `<div><span class="muted small">${esc(t('stock'))}</span><br><b>${fmtNum(p.stock)} ${esc(p.unit)}</b></div>
              <div><span class="muted small">${esc(t('inv_reorder'))}</span><br><b>${fmtNum(p.reorder_level)}</b></div>
              <div><span class="muted small">${esc(t('inv_value'))}</span><br><b>${fmtMoney(p.value, bc)}</b></div>` : ''}
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
              <button class="btn" id="m-cancel">${esc(t('cancel'))}</button>
              <button class="btn primary" id="m-save">${icon('check')} ${esc(t('inv_save_move'))}</button>
            </div>`;

          body.querySelector('#m-cancel').onclick = close;
          body.querySelector('#m-save').onclick = async () => {
            const productId = p ? p.id : (body.querySelector('#m-product')?.value || '');
            const date = body.querySelector('#m-date').value;
            const moveType = body.querySelector('#m-type').value;
            const qty = parseFloat(body.querySelector('#m-qty').value);
            const unitCost = parseFloat(body.querySelector('#m-cost').value) || 0;
            const memo = body.querySelector('#m-memo').value.trim();

            if (!productId || !date || isNaN(qty) || qty <= 0) return toast(t('err_missing_fields'), 'err');
            try {
              await api('/stock-moves', { method: 'POST', body: { product_id: productId, date, qty, unit_cost: unitCost, move_type: moveType, memo } });
              toast(t('inv_move_saved'));
              close();
              self.render(view);
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
        },
      });
    };

    /* -------- Stock Movements History -------- */
    const showMoves = async (p) => {
      try {
        const { moves } = await api('/stock-moves/' + p.id);
        modal({
          title: `${esc(t('inv_moves'))} — ${esc(p.name)}`, wide: true,
          onOpen(b2) {
            const runningStock = [];
            let bal = 0;
            const sorted = [...moves].reverse();
            for (const mv of sorted) { bal += mv.qty; runningStock.push(r2(bal)); }
            const balMap = {};
            sorted.forEach((mv, i) => { balMap[mv.id] = runningStock[i]; });

            b2.innerHTML = `
              <div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap">
                <div style="background:var(--bg);border-radius:8px;padding:10px 16px;flex:1;min-width:100px;text-align:center">
                  <div class="muted small">${esc(t('stock'))}</div>
                  <div style="font-size:1.2rem;font-weight:700">${fmtNum(p.stock)} ${esc(p.unit)}</div>
                </div>
                <div style="background:var(--bg);border-radius:8px;padding:10px 16px;flex:1;min-width:100px;text-align:center">
                  <div class="muted small">${esc(t('inv_value'))}</div>
                  <div style="font-size:1.2rem;font-weight:700;color:var(--primary)">${fmtMoney(p.value, bc)}</div>
                </div>
                <div style="background:var(--bg);border-radius:8px;padding:10px 16px;flex:1;min-width:100px;text-align:center">
                  <div class="muted small">${esc(t('inv_reorder'))}</div>
                  <div style="font-size:1.2rem;font-weight:700">${fmtNum(p.reorder_level)}</div>
                </div>
              </div>
              <div style="text-align:end;margin-bottom:8px">
                <button class="btn sm primary" id="add-move-btn">${icon('plus')} ${esc(t('inv_add_move'))}</button>
              </div>
              ${moves.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>
                <th>${esc(t('date'))}</th>
                <th>${esc(t('inv_moves_type'))}</th>
                <th>${esc(t('inv_move_source'))}</th>
                <th class="num">${esc(t('qty'))}</th>
                <th class="num">${esc(t('inv_unit_cost'))}</th>
                <th class="num">${esc(t('inv_running_balance'))}</th>
                <th>${esc(t('reference'))}</th>
              </tr></thead><tbody>
                ${moves.map(mv => `<tr>
                  <td>${esc(fmtDate(mv.date))}</td>
                  <td><span class="badge ${mv.qty > 0 ? 'green' : 'red'}">${mv.qty > 0 ? t('inv_in') : t('inv_out')}</span></td>
                  <td class="muted small">${mv.ref_type === 'manual' ? esc(t('inv_manual')) : mv.ref_type === 'invoice' ? 'INV' : 'BILL'}</td>
                  <td class="num"><b style="color:${mv.qty > 0 ? 'var(--success)' : 'var(--danger)'}">${mv.qty > 0 ? '+' : ''}${fmtNum(mv.qty)}</b></td>
                  <td class="num">${fmtMoney(mv.unit_cost, bc)}</td>
                  <td class="num">${fmtNum(balMap[mv.id] ?? 0)}</td>
                  <td class="mono">${mv.ref_type === 'manual' ? `<span class="badge gray">${esc(t('inv_manual'))}</span>` : `${mv.ref_type === 'invoice' ? 'INV' : 'BILL'}-${String(mv.ref_id).padStart(4, '0')}`}</td>
                </tr>`).join('')}
              </tbody></table></div>`
              : emptyState(t('noData'))}`;

            b2.querySelector('#add-move-btn')?.addEventListener('click', () => {
              closeModal();
              setTimeout(() => openMoveForm(p, 'in'), 150);
            });
          },
        });
      } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
    };

    view.querySelector('#new-prod').onclick = () => openForm(null);
    view.querySelector('#new-move').onclick = () => openMoveForm(null, 'in');
    draw();
  },
};
