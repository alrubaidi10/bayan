/* Chart of Accounts */
const AccountsPage = {
  title: () => t('nav_accounts'),
  async render(view) {
    const self = this;
    const { accounts } = await api('/accounts');
    const typeCls = { asset: 'green', liability: 'amber', equity: 'primary', income: 'blue', expense: 'red' };
    const typeBadge = (tp) => `<span class="badge ${typeCls[tp]}">${esc(t('type_' + tp))}</span>`;

    view.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>${esc(t('nav_accounts'))}</h3>
          <span class="muted small">${accounts.length} ${esc(t('nav_accounts'))}</span>
          <div class="spacer"></div>
          <button class="btn primary" id="add-acc">${icon('plus')} ${esc(t('acc_new'))}</button></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('code'))}</th><th>${esc(t('acc_name'))}</th><th>${esc(t('acc_name_ar'))}</th><th>${esc(t('type'))}</th><th>${esc(t('status'))}</th><th style="text-align:end">${esc(t('actions'))}</th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
      </div>`;

    const rows = view.querySelector('#rows');
    rows.innerHTML = accounts.map(a => `
      <tr data-id="${a.id}">
        <td class="mono">${esc(a.code)}</td>
        <td><b>${esc(a.name)}</b></td>
        <td class="muted">${esc(a.name_ar) || '—'}</td>
        <td>${typeBadge(a.type)}</td>
        <td>${a.is_active ? `<span class="badge green">${esc(t('active'))}</span>` : `<span class="badge gray">${esc(t('inactive'))}</span>`}</td>
        <td style="text-align:end;white-space:nowrap">
          <button class="btn sm ghost" data-act="edit">${icon('edit')} ${esc(t('edit'))}</button>
          <button class="btn sm ghost" data-act="toggle">${icon('x')} ${esc(a.is_active ? t('deactivate') : t('activate'))}</button>
        </td>
      </tr>`).join('');

    const openForm = (acc) => {
      const m = modal({
        title: acc ? t('acc_edit') : t('acc_new'),
        onOpen(body, close) {
          body.innerHTML = `
            <div class="form-grid">
              <div class="field"><label>${esc(t('acc_code'))} <span class="req">*</span></label>
                <input id="f-code" value="${esc(acc ? acc.code : '')}" ${acc ? 'disabled' : ''}></div>
              <div class="field"><label>${esc(t('acc_type'))} <span class="req">*</span></label>
                <select id="f-type" ${acc ? 'disabled' : ''}>
                  ${['asset', 'liability', 'equity', 'income', 'expense'].map(tp =>
                    `<option value="${tp}" ${acc && acc.type === tp ? 'selected' : ''}>${esc(t('type_' + tp))}</option>`).join('')}
                </select></div>
              <div class="field"><label>${esc(t('acc_name'))} <span class="req">*</span></label><input id="f-name" value="${esc(acc ? acc.name : '')}"></div>
              <div class="field"><label>${esc(t('acc_name_ar'))}</label><input id="f-name-ar" value="${esc(acc ? acc.name_ar : '')}"></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
              <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
              <button class="btn primary" id="f-save">${esc(t('save'))}</button>
            </div>`;
          body.querySelector('#f-cancel').onclick = close;
          body.querySelector('#f-save').onclick = async () => {
            const payload = {
              code: body.querySelector('#f-code').value.trim(),
              name: body.querySelector('#f-name').value.trim(),
              name_ar: body.querySelector('#f-name-ar').value.trim(),
              type: body.querySelector('#f-type').value,
            };
            if (!payload.code || !payload.name) return toast(t('err_missing_fields'), 'err');
            try {
              if (acc) await api('/accounts/' + acc.id, { method: 'PUT', body: { name: payload.name, name_ar: payload.name_ar } });
              else await api('/accounts', { method: 'POST', body: payload });
              toast(t('toast_saved'));
              close();
              self.render(view);
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
        },
      });
    };

    view.querySelector('#add-acc').onclick = () => openForm(null);
    rows.querySelectorAll('tr').forEach(tr => {
      const acc = accounts.find(a => a.id === Number(tr.dataset.id));
      tr.querySelector('[data-act=edit]').onclick = () => openForm(acc);
      tr.querySelector('[data-act=toggle]').onclick = async () => {
        if (acc.is_active && !(await confirmDlg(t('acc_deactivate_q')))) return;
        await api('/accounts/' + acc.id, { method: 'PUT', body: { is_active: !acc.is_active } });
        toast(t('toast_updated'));
        self.render(view);
      };
    });
  },
};
