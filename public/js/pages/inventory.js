/* Inventory / Products — name, category/type, quantity, price, cost, barcode… */
const InventoryPage = {
  title: () => t('nav_products'),
  async render(view) {
    const self = this;
    const { products, categories } = await api('/products');
    const bc = App.me.company.base_currency;
    const totalValue = products.reduce((s, p) => s + (p.value || 0), 0);
    const low = products.filter(p => p.low);

    view.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div>
            <h3>${esc(t('nav_products'))}</h3>
            <span class="badge primary">${esc(t('inv_value_total'))}: ${fmtMoney(totalValue, bc)}</span>
            ${low.length ? `<span class="badge red">${low.length} ${esc(t('inv_low'))}</span>` : ''}
          </div>
          <div class="spacer"></div>
          <div class="field" style="min-width:180px"><input id="p-search" placeholder="${esc(t('prod_search'))}"></div>
          <div class="field" style="min-width:150px">
            <select id="p-cat"><option value="">${esc(t('prod_all_categories'))}</option>
              ${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>
          <button class="btn primary" id="new-prod">${icon('plus')} ${esc(t('inv_new_product'))}</button>
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
      const list = products.filter(p => {
        if (cat && p.category !== cat) return false;
        if (q && !(p.name + ' ' + (p.name_ar || '') + ' ' + (p.sku || '') + ' ' + (p.category || '') + ' ' + (p.barcode || '')).toLowerCase().includes(q)) return false;
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
          <td class="num"><span class="badge ${p.low ? 'red' : 'green'}">${fmtNum(p.stock)} ${esc(p.unit)}</span></td>
          <td class="money">${fmtMoney(p.value, bc)}</td>
          <td>${p.is_active ? `<span class="badge green">${esc(t('active'))}</span>` : `<span class="badge gray">${esc(t('inactive'))}</span>`}</td>
          <td style="text-align:end;white-space:nowrap">
            <button class="btn sm ghost" data-act="moves" title="${esc(t('inv_moves'))}">${icon('layers')}</button>
            <button class="btn sm ghost" data-act="edit">${icon('edit')}</button>
          </td>
        </tr>`).join('') : `<tr><td colspan="10">${emptyState(t('noData'))}</td></tr>`;

      tbody.querySelectorAll('tr').forEach(tr => {
        const p = list.find(x => x.id === Number(tr.dataset.id));
        if (!p) return;
        const editBtn = tr.querySelector('[data-act=edit]');
        const movesBtn = tr.querySelector('[data-act=moves]');
        if (editBtn) editBtn.onclick = () => openForm(p);
        if (movesBtn) movesBtn.onclick = () => showMoves(p);
      });
    };

    view.querySelector('#p-search').oninput = debounce(draw, 200);
    view.querySelector('#p-cat').onchange = draw;

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

    const showMoves = async (p) => {
      try {
        const { moves } = await api('/stock-moves/' + p.id);
        modal({
          title: `${esc(t('inv_moves'))} — ${esc(p.name)}`,
          onOpen(b2) {
            b2.innerHTML = moves.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>
              <th>${esc(t('date'))}</th><th>${esc(t('inv_moves_type'))}</th><th class="num">${esc(t('qty'))}</th>
              <th class="num">${esc(t('inv_unit_cost'))}</th><th>${esc(t('inv_ref'))}</th></tr></thead><tbody>
              ${moves.map(mv => `<tr><td>${esc(fmtDate(mv.date))}</td>
                <td><span class="badge ${mv.qty > 0 ? 'green' : 'red'}">${mv.qty > 0 ? t('inv_in') : t('inv_out')}</span></td>
                <td class="num"><b>${fmtNum(Math.abs(mv.qty))}</b></td>
                <td class="num">${fmtMoney(mv.unit_cost, bc)}</td>
                <td class="mono">${esc(mv.ref_type === 'invoice' ? 'INV' : 'BILL')}-${String(mv.ref_id).padStart(4, '0')}</td></tr>`).join('')}</tbody></table></div>`
              : emptyState(t('noData'));
          },
        });
      } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
    };

    view.querySelector('#new-prod').onclick = () => openForm(null);
    draw();
  },
};
