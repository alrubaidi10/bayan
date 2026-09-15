/* General Ledger */
const LedgerPage = {
  title: () => t('lg_title'),
  async render(view, accountId) {
    const { accounts } = await api('/accounts');
    const bc = App.me.company.base_currency;
    view.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>${esc(t('lg_title'))}</h3>
          <div class="spacer"></div>
          <div class="field" style="min-width:280px">
            <select id="acc-select">
              <option value="">${esc(t('lg_select'))}…</option>
              ${accounts.map(a => `<option value="${a.id}" ${String(a.id) === String(accountId) ? 'selected' : ''}>${esc(a.code)} — ${esc(a.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="ledger-body"></div>
      </div>`;

    const select = view.querySelector('#acc-select');
    select.onchange = () => {
      if (select.value) location.hash = '#/ledger/' + select.value;
      else this.render(view, null);
    };
    if (!accountId) {
      view.querySelector('#ledger-body').innerHTML = emptyState(t('lg_select'));
      return;
    }
    const { account, lines } = await api('/ledger?account_id=' + accountId);
    const typeCls = { asset: 'green', liability: 'amber', equity: 'primary', income: 'blue', expense: 'red' };
    const bal = lines.length ? lines[0].balance : 0;
    view.querySelector('#ledger-body').innerHTML = `
      <div style="padding:0 18px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <span class="badge ${typeCls[account.type]}">${esc(t('type_' + account.type))}</span>
        <b>${esc(account.code)} — ${esc(account.name)}</b>
        <span class="spacer"></span>
        <span class="muted small">${esc(t('lg_running'))}:</span>
        <b class="money">${fmtMoney(bal, bc)}</b>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>${esc(t('date'))}</th><th>${esc(t('memo'))}</th><th>${esc(t('reference'))}</th>
          <th class="num">${esc(t('je_debit'))}</th><th class="num">${esc(t('je_credit'))}</th><th class="num">${esc(t('lg_running'))}</th></tr></thead>
        <tbody id="lrows"></tbody>
      </table></div>`;
    const tbody = view.querySelector('#lrows');
    tbody.innerHTML = lines.length ? lines.map(l => `
      <tr>
        <td>${esc(fmtDate(l.date))}</td>
        <td>${esc(l.memo) || '—'}</td>
        <td class="mono">${esc(l.reference) || '—'}</td>
        <td class="money">${l.debit ? fmtMoney(l.debit, bc) : ''}</td>
        <td class="money">${l.credit ? fmtMoney(l.credit, bc) : ''}</td>
        <td class="money">${fmtMoney(l.balance, bc)}</td>
      </tr>`).join('') : `<tr><td colspan="6">${emptyState(t('lg_no_lines'))}</td></tr>`;
  },
};
