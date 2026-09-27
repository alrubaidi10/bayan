/* Stock Transfers — internal transfer documents between locations */
const TransfersPage = {
  title: () => t('trf_title'),
  async render(view) {
    const self = this;
    const { transfers } = await api('/stock-transfers');

    view.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h3>${esc(t('trf_title'))}</h3>
          <span class="badge primary">${transfers.length} ${esc(t('trf_count'))}</span>
          <div class="spacer"></div>
          <button class="btn primary" id="new-trf">${icon('plus')} ${esc(t('trf_new'))}</button>
        </div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr>
            <th>${esc(t('reference'))}</th>
            <th>${esc(t('date'))}</th>
            <th>${esc(t('trf_from'))}</th>
            <th>${esc(t('trf_to'))}</th>
            <th>${esc(t('notes'))}</th>
            <th>${esc(t('status'))}</th>
            <th style="text-align:end">${esc(t('actions'))}</th>
          </tr></thead>
          <tbody>
            ${transfers.length ? transfers.map(tr => `
              <tr data-id="${tr.id}">
                <td class="mono"><b>${esc(tr.number)}</b></td>
                <td>${esc(fmtDate(tr.date))}</td>
                <td>${esc(tr.from_location)}</td>
                <td>${esc(tr.to_location)}</td>
                <td class="muted small">${esc(tr.memo || '—')}</td>
                <td>${tr.status === 'confirmed'
                  ? `<span class="badge green">${esc(t('trf_confirmed'))}</span>`
                  : `<span class="badge gray">${esc(t('draft'))}</span>`}
                </td>
                <td style="text-align:end;white-space:nowrap">
                  <button class="btn sm ghost" data-act="view">${icon('eye')}</button>
                  ${tr.status === 'draft' ? `
                    <button class="btn sm ghost" data-act="confirm" title="${esc(t('trf_confirm'))}">${icon('check')}</button>
                    <button class="btn sm ghost" data-act="del">${icon('trash')}</button>` : ''}
                </td>
              </tr>`).join('') : `<tr><td colspan="7">${emptyState(t('noData'))}</td></tr>`}
          </tbody>
        </table></div>
      </div>`;

    view.querySelector('#new-trf').onclick = () => self.openForm(view);

    view.querySelectorAll('tr[data-id]').forEach(row => {
      const trf = transfers.find(t => t.id === Number(row.dataset.id));
      if (!trf) return;
      row.querySelector('[data-act=view]')?.addEventListener('click', () => self.viewTransfer(trf.id));
      row.querySelector('[data-act=confirm]')?.addEventListener('click', async () => {
        if (!(await confirmDlg(t('trf_confirm_q')))) return;
        try {
          await api('/stock-transfers/' + trf.id + '/confirm', { method: 'POST' });
          toast(t('trf_confirmed_ok'));
          self.render(view);
        } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
      });
      row.querySelector('[data-act=del]')?.addEventListener('click', async () => {
        if (!(await confirmDlg(t('trf_delete_q')))) return;
        try {
          await api('/stock-transfers/' + trf.id, { method: 'DELETE' });
          toast(t('toast_deleted'));
          self.render(view);
        } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
      });
    });
  },

  async openForm(view, existing) {
    const self = this;
    const { products } = await api('/products');
    const activeProducts = products.filter(p => p.is_active);

    modal({
      title: t('trf_new'), wide: true,
      onOpen(body, close) {
        body.innerHTML = `
          <div class="form-grid mb">
            <div class="field"><label>${esc(t('date'))} *</label><input type="date" id="trf-date" value="${todayISO()}"></div>
            <div class="field"><label>${esc(t('trf_from'))}</label><input id="trf-from" value="${esc(t('trf_main_wh'))}" list="loc-list"></div>
            <div class="field"><label>${esc(t('trf_to'))}</label><input id="trf-to" value="${esc(t('trf_branch'))}" list="loc-list"></div>
            <datalist id="loc-list">
              <option value="${esc(t('trf_main_wh'))}">
              <option value="${esc(t('trf_branch'))}">
              <option value="${esc(t('trf_store'))}">
            </datalist>
            <div class="field"><label>${esc(t('notes'))}</label><input id="trf-memo" placeholder="${esc(t('trf_memo_ph'))}"></div>
          </div>
          <h4 style="margin:0 0 8px">${esc(t('trf_items'))}</h4>
          <div class="table-wrap"><table class="tbl" id="trf-items-tbl">
            <thead><tr>
              <th style="width:40%">${esc(t('name'))}</th>
              <th class="num" style="width:20%">${esc(t('qty'))} *</th>
              <th class="num" style="width:20%">${esc(t('inv_unit_cost'))}</th>
              <th class="num" style="width:15%">${esc(t('stock'))}</th>
              <th style="width:5%"></th>
            </tr></thead>
            <tbody id="trf-body"></tbody>
          </table></div>
          <button class="btn" id="trf-add-item" style="margin-top:8px">${icon('plus')} ${esc(t('trf_add_item'))}</button>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
            <button class="btn" id="trf-cancel">${esc(t('cancel'))}</button>
            <button class="btn primary" id="trf-save">${icon('check')} ${esc(t('trf_save'))}</button>
          </div>`;

        const tbody = body.querySelector('#trf-body');
        const addRow = (prod) => {
          const tr = el(`<tr>
            <td><select class="sel-prod">
              <option value="">${esc(t('inv_choose_product'))}</option>
              ${activeProducts.map(p => `<option value="${p.id}" data-cost="${p.cost}" data-stock="${p.stock}">${esc(p.name)} (${fmtNum(p.stock)} ${esc(p.unit)})</option>`).join('')}
            </select></td>
            <td><input type="number" class="trf-qty num" step="0.01" min="0.01" placeholder="0" style="width:90px"></td>
            <td><input type="number" class="trf-cost num" step="0.01" min="0" placeholder="0" style="width:90px"></td>
            <td class="num trf-stock muted">—</td>
            <td><button class="btn sm ghost del-trf-row">${icon('trash')}</button></td>
          </tr>`);
          if (prod) {
            tr.querySelector('.sel-prod').value = prod.id;
            tr.querySelector('.trf-cost').value = prod.cost;
            tr.querySelector('.trf-stock').textContent = fmtNum(prod.stock);
          }
          tr.querySelector('.sel-prod').onchange = function() {
            const opt = this.options[this.selectedIndex];
            tr.querySelector('.trf-cost').value = opt.dataset.cost || '';
            tr.querySelector('.trf-stock').textContent = opt.dataset.stock ? fmtNum(Number(opt.dataset.stock)) : '—';
          };
          tr.querySelector('.del-trf-row').onclick = () => tr.remove();
          tbody.appendChild(tr);
        };

        body.querySelector('#trf-add-item').onclick = () => addRow(null);
        body.querySelector('#trf-cancel').onclick = close;
        addRow(null);

        body.querySelector('#trf-save').onclick = async () => {
          const date = body.querySelector('#trf-date').value;
          const from_location = body.querySelector('#trf-from').value.trim();
          const to_location = body.querySelector('#trf-to').value.trim();
          const memo = body.querySelector('#trf-memo').value.trim();
          const items = [...tbody.querySelectorAll('tr')].map(row => ({
            product_id: Number(row.querySelector('.sel-prod').value),
            qty: parseFloat(row.querySelector('.trf-qty').value) || 0,
            unit_cost: parseFloat(row.querySelector('.trf-cost').value) || 0,
          })).filter(i => i.product_id && i.qty > 0);
          if (!date || !from_location || !to_location || !items.length) return toast(t('err_missing_fields'), 'err');
          try {
            await api('/stock-transfers', { method: 'POST', body: { date, from_location, to_location, memo, items } });
            toast(t('trf_saved'));
            close();
            self.render(view);
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },

  async viewTransfer(id) {
    const { transfer, items } = await api('/stock-transfers/' + id);
    modal({
      title: `${transfer.number} — ${esc(transfer.from_location)} → ${esc(transfer.to_location)}`, wide: true,
      onOpen(body, close) {
        body.innerHTML = `
          <div style="display:flex;gap:20px;margin-bottom:14px;flex-wrap:wrap">
            <div><span class="muted small">${esc(t('date'))}</span><br><b>${esc(fmtDate(transfer.date))}</b></div>
            <div><span class="muted small">${esc(t('trf_from'))}</span><br><b>${esc(transfer.from_location)}</b></div>
            <div><span class="muted small">${esc(t('trf_to'))}</span><br><b>${esc(transfer.to_location)}</b></div>
            <div><span class="muted small">${esc(t('status'))}</span><br>
              ${transfer.status === 'confirmed'
                ? `<span class="badge green">${esc(t('trf_confirmed'))}</span>`
                : `<span class="badge gray">${esc(t('draft'))}</span>`}
            </div>
            ${transfer.memo ? `<div style="grid-column:1/-1"><span class="muted small">${esc(t('notes'))}</span><br>${esc(transfer.memo)}</div>` : ''}
          </div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('name'))}</th><th>${esc(t('unit'))}</th><th class="num">${esc(t('qty'))}</th><th class="num">${esc(t('inv_unit_cost'))}</th><th class="num">${esc(t('total'))}</th></tr></thead>
            <tbody>
              ${items.map(it => `<tr>
                <td><b>${esc(it.name)}</b>${it.name_ar ? `<br><span class="muted small">${esc(it.name_ar)}</span>` : ''}</td>
                <td class="muted">${esc(it.unit)}</td>
                <td class="num">${fmtNum(it.qty)}</td>
                <td class="num">${fmtMoney(it.unit_cost, App.me.company.base_currency)}</td>
                <td class="num">${fmtMoney(it.qty * it.unit_cost, App.me.company.base_currency)}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><td colspan="4"><b>${esc(t('total'))}</b></td>
                <td class="num"><b>${fmtMoney(items.reduce((s, i) => s + i.qty * i.unit_cost, 0), App.me.company.base_currency)}</b></td></tr>
            </tfoot>
          </table></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
            <button class="btn" onclick="window.print()">${icon('file')} ${esc(t('print'))}</button>
            <button class="btn primary" id="trf-close">${esc(t('close'))}</button>
          </div>`;
        body.querySelector('#trf-close').onclick = close;
      },
    });
  },
};
