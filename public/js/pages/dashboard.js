/* Dashboard */
const DashboardPage = {
  title: () => t('nav_dashboard'),
  async render(view) {
    const [data, prodData, debtsData] = await Promise.all([
      api('/dashboard?lang=' + getLang()),
      api('/products'),
      api('/debts'),
    ]);
    const bc = App.me.company.base_currency;
    const k = data.kpis;
    const cards = [
      ['kpi_revenue', 'trending', 'primary', k.revenue],
      ['kpi_expenses', 'receipt', 'red', k.expenses],
      ['kpi_net', 'bar', k.net >= 0 ? 'green' : 'red', k.net],
      ['kpi_ar', 'users', 'amber', k.ar],
      ['kpi_ap', 'building', 'amber', k.ap],
      ['kpi_cash', 'wallet', 'green', k.cash],
      ['kpi_invValue', 'box', 'primary', k.invValue],
      ['kpi_lowStock', 'alert', k.lowStock > 0 ? 'red' : 'green', k.lowStock],
    ];
    view.innerHTML = `
      <div class="kpi-grid">
        ${cards.map(([lbl, ic, cls, val]) => `
          <div class="kpi ${cls}">
            <div class="k-label">${icon(ic)} ${esc(t(lbl))}</div>
            <div class="k-value">${fmtMoney(val, bc)}</div>
          </div>`).join('')}
      </div>
      <div class="grid-2 mt">
        <div class="card">
          <div class="card-head"><h3>${esc(t('chart_title'))}</h3><span class="muted small">${esc(t('chart_sub'))}</span></div>
          <div class="card-body">
            <div class="chart-bar" id="chart"></div>
            <div class="chart-legend"><span><i class="legend-rev"></i>${esc(t('legend_revenue'))}</span><span><i class="legend-exp"></i>${esc(t('legend_expenses'))}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${esc(t('quick_actions'))}</h3></div>
          <div class="card-body" style="display:grid;gap:8px;grid-template-columns:1fr 1fr">
            <button class="btn" data-q="invoice">${icon('file')} ${esc(t('qa_invoice'))}</button>
            <button class="btn" data-q="bill">${icon('truck')} ${esc(t('qa_bill'))}</button>
            <button class="btn" data-q="expense">${icon('receipt')} ${esc(t('qa_expense'))}</button>
            <button class="btn" data-q="product">${icon('box')} ${esc(t('qa_product'))}</button>
            <button class="btn" data-q="journal" style="grid-column:1/-1">${icon('pen')} ${esc(t('qa_journal'))}</button>
          </div>
        </div>
      </div>
      <div class="grid-2 mt">
        <div class="card">
          <div class="card-head"><h3>${esc(t('db_debts'))} — ${esc(t('debts_ar'))}</h3>
            <div class="spacer"></div>
            <button class="btn sm ghost" onclick="location.hash='#/debts'">${esc(t('view_all'))}</button></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('name'))}</th><th class="num">${esc(t('rep_outstanding'))}</th></tr></thead>
            <tbody id="debt-ar-rows"></tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${esc(t('db_debts'))} — ${esc(t('debts_ap'))}</h3>
            <div class="spacer"></div>
            <button class="btn sm ghost" onclick="location.hash='#/debts'">${esc(t('view_all'))}</button></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('name'))}</th><th class="num">${esc(t('rep_outstanding'))}</th></tr></thead>
            <tbody id="debt-ap-rows"></tbody>
          </table></div>
        </div>
      </div>
      <div class="card mt">
        <div class="card-head"><h3>${esc(t('prod_recent'))}</h3>
          <span class="muted small">${prodData.products.length} ${esc(t('nav_products'))}</span>
          <div class="spacer"></div>
          <button class="btn sm ghost" onclick="location.hash='#/inventory'">${esc(t('view_all'))}</button></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('name'))}</th><th>${esc(t('prod_category'))}</th>
            <th class="num">${esc(t('stock'))}</th><th class="num">${esc(t('inv_price'))}</th><th class="num">${esc(t('inv_value'))}</th></tr></thead>
          <tbody id="prod-rows"></tbody>
        </table></div>
      </div>
      <div class="grid-2 mt">
        <div class="card">
          <div class="card-head"><h3>${esc(t('recent_invoices'))}</h3><div class="spacer"></div>
            <button class="btn sm ghost" onclick="location.hash='#/invoices'">${esc(t('view_all'))}</button></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('inv_number'))}</th><th>${esc(t('date'))}</th><th>${esc(t('name'))}</th><th class="num">${esc(t('total'))}</th><th>${esc(t('status'))}</th></tr></thead>
            <tbody id="recent-rows"></tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${esc(t('low_stock_title'))}</h3></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('name'))}</th><th class="num">${esc(t('stock'))}</th><th class="num">${esc(t('inv_reorder'))}</th></tr></thead>
            <tbody id="low-rows"></tbody>
          </table></div>
        </div>
      </div>`;

    /* bar chart */
    const max = Math.max(...data.months.map(m => Math.max(m.revenue, m.expense)), 1);
    view.querySelector('#chart').innerHTML = data.months.map(m => `
      <div class="col" title="${esc(m.label)}">
        <div class="bar rev" style="height:${Math.round(m.revenue / max * 100)}%"></div>
        <div class="bar exp" style="height:${Math.round(m.expense / max * 100)}%"></div>
        <div class="lbl">${esc(m.label)}</div>
      </div>`).join('');

    /* debts card: top debtors & creditors */
    const debtRows = (sel, list) => {
      const tbody = view.querySelector(sel);
      tbody.innerHTML = list.slice(0, 5).map(c => `
        <tr><td><b>${esc(c.name)}</b></td>
        <td class="money" style="color:var(--red)">${fmtMoney(c.outstanding, bc)}</td></tr>`).join('')
        || `<tr><td colspan="2">${emptyState(t('debts_no_debts'))}</td></tr>`;
      if (list.length > 5) tbody.insertAdjacentHTML('beforeend', `<tr><td class="muted small">+${list.length - 5} ${esc(t('view_all'))}…</td><td></td></tr>`);
    };
    debtRows('#debt-ar-rows', debtsData.ar);
    debtRows('#debt-ap-rows', debtsData.ap);

    /* products list */
    const prodRows = view.querySelector('#prod-rows');
    const prods = prodData.products.slice(0, 8);
    prodRows.innerHTML = prods.length
      ? prods.map(p => `
        <tr>
          <td><b>${esc(p.name)}</b>${p.name_ar ? ` <span class="muted small">${esc(p.name_ar)}</span>` : ''}</td>
          <td>${p.category ? `<span class="badge primary">${esc(p.category)}</span>` : '<span class="muted small">—</span>'}</td>
          <td class="num"><span class="badge ${p.low ? 'red' : 'green'}">${fmtNum(p.stock)} ${esc(p.unit)}</span></td>
          <td class="money">${fmtMoney(p.price, bc)}</td>
          <td class="money">${fmtMoney(p.value, bc)}</td>
        </tr>`).join('')
      : `<tr><td colspan="5">${emptyState(t('noData'))}</td></tr>`;

    const recentRows = view.querySelector('#recent-rows');
    recentRows.innerHTML = data.recentInvoices.length
      ? data.recentInvoices.map(r => `
        <tr><td class="mono">${esc(r.number)}</td><td>${esc(fmtDate(r.date))}</td>
        <td>${esc(r.contact_name || '—')}</td>
        <td class="money">${fmtMoney(r.total / r.fx_rate, bc)}</td><td>${badge(r.status)}</td></tr>`).join('')
      : `<tr><td colspan="5">${emptyState(t('noData'))}</td></tr>`;

    const lowRows = view.querySelector('#low-rows');
    lowRows.innerHTML = data.lowStockProducts.length
      ? data.lowStockProducts.map(p => `
        <tr><td>${esc(p.name)}</td><td class="num"><span class="badge red">${fmtNum(p.stock)} ${esc(p.unit)}</span></td>
        <td class="num">${fmtNum(p.reorder_level)}</td></tr>`).join('')
      : `<tr><td colspan="3">${emptyState(t('noData'))}</td></tr>`;

    /* quick actions */
    view.querySelectorAll('[data-q]').forEach(btn => {
      btn.onclick = () => {
        const q = btn.dataset.q;
        if (q === 'invoice') location.hash = '#/invoices';
        else if (q === 'bill') location.hash = '#/bills';
        else if (q === 'expense') location.hash = '#/expenses';
        else if (q === 'product') location.hash = '#/inventory';
        else if (q === 'journal') location.hash = '#/journal';
      };
    });
  },
};
