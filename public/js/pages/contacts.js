/* Contacts: Customers & Suppliers */
function ContactsPage(kind) {
  const isCustomer = kind === 'customer';
  return {
    title: () => t(isCustomer ? 'nav_customers' : 'nav_suppliers'),
    async render(view) {
      const self = this;
      const { contacts } = await api('/contacts?kind=' + kind);
      const bc = App.me.company.base_currency;
      const totalBalance = contacts.reduce((s, c) => s + (c.balance || 0), 0);

      view.innerHTML = `
        <div class="card">
          <div class="card-head">
            <div>
              <h3>${esc(t(isCustomer ? 'nav_customers' : 'nav_suppliers'))}</h3>
              <span class="muted small">${t('con_count', { n: contacts.length })} · ${esc(t('con_outstanding'))}: <b>${fmtMoney(totalBalance, bc)}</b></span>
            </div>
            <div class="spacer"></div>
            <div class="field" style="min-width:200px"><input id="f-search" placeholder="${esc(t('search'))}"></div>
            <button class="btn primary" id="new-con">${icon('plus')} ${esc(t(isCustomer ? 'con_new_customer' : 'con_new_supplier'))}</button>
          </div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr>
              <th>${esc(t('name'))}</th>
              <th>${esc(t('email'))}</th>
              <th>${esc(t('phone'))}</th>
              <th>${esc(t('address'))}</th>
              <th>${esc(t('con_tax_no'))}</th>
              <th>${esc(t('currency'))}</th>
              <th class="num">${esc(t('con_outstanding'))}</th>
              <th style="text-align:end">${esc(t('actions'))}</th>
            </tr></thead>
            <tbody id="rows"></tbody>
          </table></div>
        </div>`;

      const tbody = view.querySelector('#rows');
      const draw = (filter = '') => {
        const q = filter.trim().toLowerCase();
        const list = contacts.filter(c => !q || (c.name + ' ' + (c.email || '') + ' ' + (c.phone || '') + ' ' + (c.address || '')).toLowerCase().includes(q));
        tbody.innerHTML = list.length ? list.map(c => {
          const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
          const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('مرحباً ' + c.name + '، تذكير بخصوص بيان الحساب في نظام بيان.')}` : '#';
          return `
          <tr data-id="${c.id}">
            <td><b>${esc(c.name)}</b></td>
            <td class="muted">${esc(c.email) || '—'}</td>
            <td class="muted">${esc(c.phone) || '—'}</td>
            <td class="muted small">${esc(c.address) || '—'}</td>
            <td class="mono muted">${esc(c.tax_no) || '—'}</td>
            <td class="muted">${esc(c.currency || bc)}</td>
            <td class="money ${c.balance > 0 ? '' : 'muted'}">${c.balance ? fmtMoney(c.balance, bc) : '—'}</td>
            <td style="text-align:end;white-space:nowrap">
              ${c.phone ? `<a class="btn sm ghost green" href="${waUrl}" target="_blank" title="إرسال رسالة واتساب">💬 واتساب</a>` : ''}
              ${c.email ? `<a class="btn sm ghost" href="mailto:${esc(c.email)}" target="_blank" title="إرسال بريد إلكتروني">✉️ بريد</a>` : ''}
              <button class="btn sm ghost" data-act="edit">${icon('edit')} ${esc(t('edit'))}</button>
            </td>
          </tr>`;
        }).join('') : `<tr><td colspan="8">${emptyState(t('noData'))}</td></tr>`;

        tbody.querySelectorAll('tr').forEach(tr => {
          const c = list.find(x => x.id === Number(tr.dataset.id));
          if (!c) return;
          const editBtn = tr.querySelector('[data-act=edit]');
          if (editBtn) editBtn.onclick = () => openForm(c);
        });
      };

      view.querySelector('#f-search').oninput = debounce(e => draw(e.target.value), 200);
      draw('');

      const openForm = (c) => {
        modal({
          title: c ? t('con_edit') : t(isCustomer ? 'con_new_customer' : 'con_new_supplier'),
          onOpen(body, close) {
            const curOptions = Object.values(App.currencies).map(x => x.code);
            body.innerHTML = `
              <div class="form-grid">
                <div class="field"><label>${esc(t('name'))} *</label><input id="f-name" value="${esc(c ? c.name : '')}"></div>
                <div class="field"><label>${esc(t('email'))}</label><input id="f-email" value="${esc(c ? c.email : '')}"></div>
                <div class="field"><label>${esc(t('phone'))}</label><input id="f-phone" value="${esc(c ? c.phone : '')}"></div>
                <div class="field"><label>${esc(t('con_tax_no'))}</label><input id="f-tax" value="${esc(c ? c.tax_no : '')}"></div>
                <div class="field"><label>${esc(t('con_currency'))}</label>
                  <select id="f-currency">
                    <option value="">${esc(t('baseCurrency'))} — ${esc(App.me.company.base_currency)}</option>
                    ${curOptions.map(x => `<option value="${x}" ${c && c.currency === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
                  </select></div>
                <div class="field" style="grid-column:1/-1"><label>${esc(t('address'))}</label><input id="f-address" value="${esc(c ? c.address : '')}"></div>
              </div>
              <p class="muted small mt">${esc(t('con_currency_hint'))}</p>
              <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
                <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
                <button class="btn primary" id="f-save">${esc(t('save'))}</button>
              </div>`;
            body.querySelector('#f-cancel').onclick = close;
            body.querySelector('#f-save').onclick = async () => {
              const payload = {
                name: body.querySelector('#f-name').value.trim(),
                email: body.querySelector('#f-email').value.trim(),
                phone: body.querySelector('#f-phone').value.trim(),
                address: body.querySelector('#f-address').value.trim(),
                tax_no: body.querySelector('#f-tax').value.trim(),
                currency: body.querySelector('#f-currency').value,
              };
              if (!payload.name) return toast(t('err_missing_fields'), 'err');
              try {
                if (c) await api('/contacts/' + c.id, { method: 'PUT', body: payload });
                else await api('/contacts', { method: 'POST', body: { ...payload, kind } });
                toast(t('toast_saved'));
                close();
                self.render(view);
              } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
            };
          },
        });
      };

      view.querySelector('#new-con').onclick = () => openForm(null);
    },
  };
}
