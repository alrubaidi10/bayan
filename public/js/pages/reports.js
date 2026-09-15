/* Reports: Trial Balance, P&L, Balance Sheet */
const TrialPage = {
  title: () => t('tb_title'),
  async render(view) {
    const { rows, totals } = await api('/trial-balance');
    const bc = App.me.company.base_currency;
    const typeCls = { asset: 'green', liability: 'amber', equity: 'primary', income: 'blue', expense: 'red' };
    const diff = Math.abs(totals.debit - totals.credit);
    view.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>${esc(t('tb_title'))}</h3>
          <div class="spacer"></div>
          ${diff < 0.01 ? `<span class="badge green">${esc(t('tb_ok'))}</span>` : `<span class="badge red">${esc(t('tb_bad'))} (${fmtMoney(diff, bc)})</span>`}
          <button class="btn sm ghost" onclick="window.print()">${icon('file')} ${esc(t('print'))}</button></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('code'))}</th><th>${esc(t('acc_name'))}</th><th>${esc(t('type'))}</th>
            <th class="num">${esc(t('tb_debit'))}</th><th class="num">${esc(t('tb_credit'))}</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td class="mono">${esc(r.code)}</td><td>${esc(r.name)}</td>
              <td><span class="badge ${typeCls[r.type]}">${esc(t('type_' + r.type))}</span></td>
              <td class="money">${r.debit ? fmtMoney(r.debit, bc) : ''}</td>
              <td class="money">${r.credit ? fmtMoney(r.credit, bc) : ''}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="3">${esc(t('tb_totals'))}</td>
            <td class="money">${fmtMoney(totals.debit, bc)}</td><td class="money">${fmtMoney(totals.credit, bc)}</td></tr></tfoot>
        </table></div>
      </div>`;
  },
};

const PnLPage = {
  title: () => t('pnl_title'),
  async render(view) {
    view.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>${esc(t('pnl_title'))}</h3>
          <div class="spacer"></div>
          <div class="field" style="min-width:150px"><input type="date" id="f-from" value="${new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)}"></div>
          <div class="field" style="min-width:150px"><input type="date" id="f-to" value="${todayISO()}"></div>
          <button class="btn" id="f-apply">${esc(t('apply'))}</button>
          <button class="btn sm ghost" onclick="window.print()">${icon('file')} ${esc(t('print'))}</button>
        </div>
        <div class="card-body" id="pnl-body"></div>
      </div>`;
    const load = async () => {
      const from = view.querySelector('#f-from').value;
      const to = view.querySelector('#f-to').value;
      const data = await api('/pnl?from=' + from + '&to=' + to);
      const bc = App.me.company.base_currency;
      const section = (title, rows, total) => `
        <h4 style="margin:8px 0 4px">${esc(title)}</h4>
        <div class="table-wrap"><table class="tbl">
          <tbody>
            ${rows.map(r => `<tr><td class="mono muted">${esc(r.code)}</td><td>${esc(r.name)}</td>
              <td class="money">${fmtMoney(r.amount, bc)}</td></tr>`).join('') || `<tr><td colspan="3" class="muted small">${esc(t('noData'))}</td></tr>`}
          </tbody>
          <tfoot><tr><td colspan="2">${esc(t('total'))}</td><td class="money">${fmtMoney(total, bc)}</td></tr></tfoot>
        </table></div>`;
      view.querySelector('#pnl-body').innerHTML = `
        ${section(t('pnl_income'), data.income, data.totalIncome)}
        ${section(t('pnl_expenses'), data.expense, data.totalExpense)}
        <div class="summary-box mt" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <b>${esc(t('pnl_net'))}</b>
          <b class="money" style="color:${data.net >= 0 ? 'var(--green)' : 'var(--red)'};font-size:16px">${fmtMoney(data.net, bc)}</b>
        </div>`;
    };
    view.querySelector('#f-apply').onclick = load;
    load();
  },
};

const BalanceSheetPage = {
  title: () => t('bs_title'),
  async render(view) {
    view.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>${esc(t('bs_title'))}</h3>
          <div class="spacer"></div>
          <div class="field" style="min-width:170px"><input type="date" id="f-asof" value="${todayISO()}"></div>
          <button class="btn" id="f-apply">${esc(t('apply'))}</button>
          <button class="btn sm ghost" onclick="window.print()">${icon('file')} ${esc(t('print'))}</button>
        </div>
        <div class="card-body" id="bs-body"></div>
      </div>`;
    const load = async () => {
      const asof = view.querySelector('#f-asof').value;
      const data = await api('/balance-sheet?asof=' + asof);
      const bc = App.me.company.base_currency;
      const section = (title, rows, total) => `
        <h4 style="margin:8px 0 4px">${esc(title)} <span class="muted small">(${esc(t('asOf'))} ${esc(fmtDate(data.asof))})</span></h4>
        <div class="table-wrap"><table class="tbl">
          <tbody>
            ${rows.map(r => `<tr><td class="mono muted">${esc(r.code)}</td><td>${esc(r.name)}</td>
              <td class="money">${fmtMoney(r.amount, bc)}</td></tr>`).join('') || `<tr><td colspan="3" class="muted small">${esc(t('noData'))}</td></tr>`}
          </tbody>
          <tfoot><tr><td colspan="2">${esc(t('total'))}</td><td class="money">${fmtMoney(total, bc)}</td></tr></tfoot>
        </table></div>`;
      view.querySelector('#bs-body').innerHTML = `
        <div class="grid-2" style="align-items:start">
          <div>${section(t('bs_assets'), data.assets, data.totalAssets)}</div>
          <div>
            ${section(t('bs_liabilities'), data.liabilities, data.totalLiab)}
            ${section(t('bs_equity'), data.equity, data.totalEquity)}
          </div>
        </div>
        <div class="summary-box mt" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span>${esc(t('bs_total_assets'))} <b class="money">${fmtMoney(data.totalAssets, bc)}</b></span>
          <span>${esc(t('bs_liab_equity'))} <b class="money">${fmtMoney(data.totalLiabEquity, bc)}</b></span>
        </div>`;
    };
    view.querySelector('#f-apply').onclick = load;
    load();
  },
};
