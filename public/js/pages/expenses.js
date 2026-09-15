/* Expenses — create / edit / delete + filters + multi-currency */
const ExpensesPage = {
  title: () => t('nav_expenses'),
  async render(view) {
    const self = this;
    const [{ expenses }, { accounts }] = await Promise.all([api('/expenses'), api('/accounts')]);
    const bc = App.me.company.base_currency;
    const expenseAccounts = accounts.filter(a => a.type === 'expense' && a.is_active);

    view.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h3>${esc(t('nav_expenses'))}</h3>
          <div class="spacer"></div>
          <button class="btn primary" id="new-exp">${icon('plus')} ${esc(t('exp_new'))}</button>
        </div>
        <div class="card-body">
          <div class="rep-filters" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
            <div class="field"><label>${esc(t('rep_from'))}</label><input type="date" id="f-from"></div>
            <div class="field"><label>${esc(t('rep_to'))}</label><input type="date" id="f-to"></div>
            <div class="field"><label>${esc(t('exp_account'))}</label>
              <select id="f-account"><option value="">${esc(t('all'))}</option>
                ${expenseAccounts.map(a => `<option value="${a.id}">${esc(a.code)} — ${esc(a.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field" style="min-width:180px"><label>${esc(t('search'))}</label><input id="f-search" placeholder="${esc(t('search'))}"></div>
          </div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr>
              <th>${esc(t('date'))}</th>
              <th>${esc(t('memo'))}</th>
              <th>${esc(t('exp_account'))}</th>
              <th>${esc(t('currency'))}</th>
              <th class="num">${esc(t('amount'))}</th>
              <th class="num">${esc(t('amount'))} (${esc(bc)})</th>
              <th style="text-align:end">${esc(t('actions'))}</th>
            </tr></thead>
            <tbody id="rows"></tbody>
            <tfoot><tr><td colspan="5"><b>${esc(t('rep_total'))}</b></td><td class="money" id="sum" style="font-weight:bold;color:var(--primary-color)">0</td><td></td></tr></tfoot>
          </table></div>
        </div>
      </div>`;

    const tbody = view.querySelector('#rows');
    const draw = () => {
      const from = view.querySelector('#f-from').value;
      const to = view.querySelector('#f-to').value;
      const accId = view.querySelector('#f-account').value ? Number(view.querySelector('#f-account').value) : null;
      const q = view.querySelector('#f-search').value.trim().toLowerCase();
      const list = expenses.filter(e => {
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        if (accId && e.account_id !== accId) return false;
        if (q && !(e.memo + ' ' + (e.account_name || '') + ' ' + (e.currency || '')).toLowerCase().includes(q)) return false;
        return true;
      });
      let total = 0;
      tbody.innerHTML = list.length ? list.map(e => {
        const baseAmt = e.base_amount || e.amount;
        total += baseAmt;
        return `<tr data-id="${e.id}">
          <td>${esc(fmtDate(e.date))}</td>
          <td><b>${esc(e.memo) || '—'}</b></td>
          <td>${esc(e.account_name)}</td>
          <td><span class="badge primary">${esc(e.currency || bc)}</span></td>
          <td class="money">${fmtMoney(e.amount, e.currency || bc)}</td>
          <td class="money"><b>${fmtMoney(baseAmt, bc)}</b></td>
          <td style="text-align:end;white-space:nowrap">
            <button class="btn sm ghost" data-act="edit">${icon('edit')}</button>
            <button class="btn sm ghost" data-act="del">${icon('trash')}</button>
          </td>
        </tr>`;
      }).join('') : `<tr><td colspan="7">${emptyState(t('noData'))}</td></tr>`;
      
      view.querySelector('#sum').textContent = fmtMoney(total, bc);

      tbody.querySelectorAll('tr').forEach(tr => {
        const ex = list.find(x => x.id === Number(tr.dataset.id));
        if (!ex) return;
        const editBtn = tr.querySelector('[data-act=edit]');
        const delBtn = tr.querySelector('[data-act=del]');
        if (editBtn) editBtn.onclick = () => self.formModal(ex, () => self.render(view));
        if (delBtn) delBtn.onclick = async () => {
          if (!(await confirmDlg(t('exp_delete_q')))) return;
          try {
            await api('/expenses/' + ex.id, { method: 'DELETE' });
            toast(t('exp_deleted'));
            self.render(view);
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      });
    };

    ['#f-from', '#f-to', '#f-account'].forEach(s => view.querySelector(s).addEventListener('change', draw));
    view.querySelector('#f-search').addEventListener('input', debounce(draw, 200));
    draw();

    view.querySelector('#new-exp').onclick = () => self.formModal(null, () => self.render(view));
  },

  formModal(ex, refresh) {
    const bc = App.me.company.base_currency;
    modal({
      title: ex ? t('exp_edit') : t('exp_new'),
      onOpen(body, close) {
        api('/accounts').then(({ accounts }) => {
          const expenseAccounts = accounts.filter(a => a.type === 'expense' && a.is_active);
          const cashAccounts = accounts.filter(a => a.code.startsWith('10') && a.is_active);
          const apAccount = accounts.find(a => a.code === '2100');
          const curOptions = Object.values(App.currencies);
          const selectedCur = ex ? ex.currency : bc;
          const curObj = App.currencies[selectedCur] || { rate: 1 };

          body.innerHTML = `
            <div class="form-grid">
              <div class="field"><label>${esc(t('date'))} *</label><input type="date" id="f-date" value="${esc(ex ? ex.date : todayISO())}"></div>
              <div class="field"><label>${esc(t('exp_account'))} *</label>
                <select id="f-account">${expenseAccounts.map(a => `<option value="${a.id}" ${ex && ex.account_id === a.id ? 'selected' : ''}>${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select></div>
              <div class="field"><label>${esc(t('amount'))} *</label><input type="number" step="0.01" min="0" id="f-amount" value="${ex ? ex.amount : ''}"></div>
              <div class="field"><label>${esc(t('currency'))} *</label>
                <select id="f-cur">${curOptions.map(c => `<option value="${c.code}" ${c.code === selectedCur ? 'selected' : ''}>${esc(c.code)} (${c.symbol || c.code})</option>`).join('')}</select></div>
              <div class="field"><label id="f-rate-lbl">${esc(t('inv_fx', { cur: selectedCur, base: 1, baseCur: bc }))}</label>
                <input type="number" step="0.0001" id="f-rate" value="${ex ? ex.fx_rate : (curObj.rate || 1)}"></div>
              <div class="field"><label>${esc(t('exp_pay_from'))}</label>
                <select id="f-payfrom">
                  ${cashAccounts.map(a => `<option value="${a.id}" ${ex && ex.payment_account_id === a.id ? 'selected' : ''}>${esc(a.code)} — ${esc(a.name)}</option>`).join('')}
                  ${apAccount ? `<option value="${apAccount.id}" ${ex && ex.payment_account_id === apAccount.id ? 'selected' : ''}>${esc(apAccount.code)} — ${esc(t('exp_payable'))}</option>` : ''}
                </select></div>
              <div class="field" style="grid-column:1/-1"><label>${esc(t('memo'))}</label><input id="f-memo" value="${esc(ex ? ex.memo : '')}"></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
              <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
              <button class="btn primary" id="f-save">${esc(t('save'))}</button>
            </div>`;

          const setRate = () => {
            const curCode = body.querySelector('#f-cur').value;
            const c = App.currencies[curCode] || { rate: 1 };
            body.querySelector('#f-rate').value = c.rate || 1;
            body.querySelector('#f-rate-lbl').textContent = t('inv_fx', { cur: curCode, base: 1, baseCur: bc });
          };
          body.querySelector('#f-cur').onchange = setRate;

          body.querySelector('#f-cancel').onclick = close;
          body.querySelector('#f-save').onclick = async () => {
            const payload = {
              date: body.querySelector('#f-date').value,
              account_id: Number(body.querySelector('#f-account').value),
              amount: parseFloat(body.querySelector('#f-amount').value),
              currency: body.querySelector('#f-cur').value,
              fx_rate: parseFloat(body.querySelector('#f-rate').value) || 1,
              payment_account_id: body.querySelector('#f-payfrom').value ? Number(body.querySelector('#f-payfrom').value) : null,
              memo: body.querySelector('#f-memo').value.trim(),
            };
            if (!payload.date || !payload.account_id || !payload.amount) return toast(t('err_missing_fields'), 'err');
            try {
              if (ex) {
                await api('/expenses/' + ex.id, { method: 'PUT', body: payload });
                toast(t('exp_updated'));
              } else {
                await api('/expenses', { method: 'POST', body: payload });
                toast(t('toast_posted'));
              }
              close();
              refresh();
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
        });
      },
    });
  },
};
