/* Inventory Print / Stocktaking Report */
const InventoryPrintPage = {
  title: () => t('inv_print_title'),
  async render(view) {
    const { products, totalValue, totalItems, categories, company } = await api('/inventory/print-report');
    const bc = App.me.company.base_currency;
    const today = fmtDate(new Date().toISOString());

    // Group by category
    const grouped = {};
    products.forEach(p => {
      const cat = p.category || t('inv_uncategorized');
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    view.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h3>${esc(t('inv_print_title'))}</h3>
          <span class="badge primary">${totalItems} ${esc(t('kpi_products'))}</span>
          <span class="badge green">${esc(t('kpi_invValue'))}: ${fmtMoney(totalValue, bc)}</span>
          <div class="spacer"></div>
          <!-- Filters -->
          <div class="field" style="min-width:140px">
            <select id="cat-filter">
              <option value="">${esc(t('prod_all_categories'))}</option>
              ${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="min-width:140px">
            <select id="stock-filter">
              <option value="">${esc(t('inv_filter_all'))}</option>
              <option value="low">${esc(t('inv_filter_low'))}</option>
              <option value="out">${esc(t('inv_filter_out'))}</option>
              <option value="ok">${esc(t('inv_filter_ok'))}</option>
            </select>
          </div>
          <button class="btn primary" id="btn-print">${icon('file')} ${esc(t('inv_print_now'))}</button>
        </div>

        <!-- Print Area -->
        <div id="inv-print-area" style="padding:8px">
          <!-- Report Header (shows in print) -->
          <div id="report-header" style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <div style="font-size:1.3rem;font-weight:800">${esc(company.name || App.me.company.name)}</div>
                ${company.address ? `<div class="muted small">${esc(company.address)}</div>` : ''}
                ${company.tax_no ? `<div class="muted small">${esc(t('set_tax_no'))}: ${esc(company.tax_no)}</div>` : ''}
              </div>
              <div style="text-align:end">
                <div style="font-size:1.1rem;font-weight:700">${esc(t('inv_print_title'))}</div>
                <div class="muted small">${esc(t('date'))}: ${esc(today)}</div>
                <div class="muted small">${esc(t('inv_print_as_of'))}: ${esc(today)}</div>
              </div>
            </div>
            <hr style="margin:10px 0;border-color:var(--border)">
          </div>

          <!-- KPI Summary -->
          <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
            <div style="background:var(--bg);padding:10px 18px;border-radius:8px;flex:1;min-width:120px">
              <div class="muted small">${esc(t('kpi_products'))}</div>
              <div style="font-size:1.3rem;font-weight:700">${fmtNum(totalItems, 0)}</div>
            </div>
            <div style="background:var(--bg);padding:10px 18px;border-radius:8px;flex:1;min-width:120px">
              <div class="muted small">${esc(t('kpi_invValue'))}</div>
              <div style="font-size:1.3rem;font-weight:700;color:var(--primary)">${fmtMoney(totalValue, bc)}</div>
            </div>
            <div style="background:var(--bg);padding:10px 18px;border-radius:8px;flex:1;min-width:120px">
              <div class="muted small">${esc(t('inv_low_stock_items'))}</div>
              <div style="font-size:1.3rem;font-weight:700;color:var(--danger)">${fmtNum(products.filter(p => p.low && p.stock > 0).length, 0)}</div>
            </div>
            <div style="background:var(--bg);padding:10px 18px;border-radius:8px;flex:1;min-width:120px">
              <div class="muted small">${esc(t('inv_out_of_stock'))}</div>
              <div style="font-size:1.3rem;font-weight:700;color:var(--danger)">${fmtNum(products.filter(p => p.stock <= 0).length, 0)}</div>
            </div>
          </div>

          <!-- Products Table -->
          <div id="products-table-area">
            ${Object.entries(grouped).map(([cat, prods]) => `
              <div class="cat-section" data-cat="${esc(cat)}">
                <div style="background:var(--primary);color:#fff;padding:6px 14px;border-radius:6px;font-weight:700;margin-bottom:6px;font-size:.9rem">
                  ${esc(cat)} <span style="opacity:.7;font-size:.8rem">(${prods.length})</span>
                </div>
                <div class="table-wrap"><table class="tbl" style="margin-bottom:14px">
                  <thead><tr>
                    <th>${esc(t('name'))}</th>
                    <th class="mono">${esc(t('inv_sku'))}</th>
                    <th>${esc(t('unit'))}</th>
                    <th class="num">${esc(t('inv_reorder'))}</th>
                    <th class="num">${esc(t('inv_cost'))}</th>
                    <th class="num">${esc(t('inv_price'))}</th>
                    <th class="num">${esc(t('stock'))}</th>
                    <th class="num">${esc(t('inv_value'))}</th>
                    <th>${esc(t('status'))}</th>
                    <th style="min-width:80px">${esc(t('inv_actual_count'))}</th>
                  </tr></thead>
                  <tbody>
                    ${prods.map(p => `<tr class="prod-row" data-cat="${esc(p.category || '')}" data-low="${p.low}" data-out="${p.stock <= 0}">
                      <td><b>${esc(p.name)}</b>${p.name_ar ? `<br><span class="muted small">${esc(p.name_ar)}</span>` : ''}</td>
                      <td class="mono muted">${esc(p.sku) || '—'}</td>
                      <td class="muted">${esc(p.unit)}</td>
                      <td class="num muted">${fmtNum(p.reorder_level)}</td>
                      <td class="money">${fmtMoney(p.cost, bc)}</td>
                      <td class="money">${fmtMoney(p.price, bc)}</td>
                      <td class="num">
                        <span class="badge ${p.stock <= 0 ? 'red' : p.low ? 'amber' : 'green'}">${fmtNum(p.stock)}</span>
                      </td>
                      <td class="money">${fmtMoney(p.value, bc)}</td>
                      <td>${p.stock <= 0
                        ? `<span class="badge red">${esc(t('inv_out_of_stock'))}</span>`
                        : p.low
                          ? `<span class="badge amber">${esc(t('inv_low'))}</span>`
                          : `<span class="badge green">${esc(t('inv_ok'))}</span>`}
                      </td>
                      <td style="min-width:80px"><div style="border-bottom:1px solid #999;height:24px"></div></td>
                    </tr>`).join('')}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="7"><b>${esc(t('inv_cat_total'))}</b></td>
                      <td class="money"><b>${fmtMoney(prods.reduce((s, p) => s + p.value, 0), bc)}</b></td>
                      <td colspan="2"></td>
                    </tr>
                  </tfoot>
                </table></div>
              </div>`).join('')}

            <!-- Grand Total -->
            <div style="display:flex;justify-content:flex-end;margin-top:8px;padding-top:12px;border-top:2px solid var(--border)">
              <div style="text-align:end">
                <span class="muted">${esc(t('inv_grand_total_value'))}</span>
                <span style="font-size:1.3rem;font-weight:800;color:var(--primary);margin-left:12px">${fmtMoney(totalValue, bc)}</span>
              </div>
            </div>

            <!-- Signature area for stocktaking -->
            <div style="display:flex;gap:40px;margin-top:40px;flex-wrap:wrap">
              <div style="flex:1;min-width:150px;text-align:center">
                <div style="border-top:1px solid #999;padding-top:6px;margin-top:60px;font-size:.85rem;color:var(--muted)">${esc(t('inv_counter_sig'))}</div>
              </div>
              <div style="flex:1;min-width:150px;text-align:center">
                <div style="border-top:1px solid #999;padding-top:6px;margin-top:60px;font-size:.85rem;color:var(--muted)">${esc(t('inv_supervisor_sig'))}</div>
              </div>
              <div style="flex:1;min-width:150px;text-align:center">
                <div style="border-top:1px solid #999;padding-top:6px;margin-top:60px;font-size:.85rem;color:var(--muted)">${esc(t('inv_manager_sig'))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    /* ---- Filters ---- */
    const applyFilter = () => {
      const catF = view.querySelector('#cat-filter').value;
      const stockF = view.querySelector('#stock-filter').value;
      view.querySelectorAll('.prod-row').forEach(row => {
        const catMatch = !catF || row.dataset.cat === catF;
        const isLow = row.dataset.low === 'true';
        const isOut = row.dataset.out === 'true';
        const stockMatch = !stockF
          || (stockF === 'low' && isLow && !isOut)
          || (stockF === 'out' && isOut)
          || (stockF === 'ok' && !isLow && !isOut);
        row.style.display = catMatch && stockMatch ? '' : 'none';
      });
      // Hide empty category sections
      view.querySelectorAll('.cat-section').forEach(sec => {
        const visible = [...sec.querySelectorAll('.prod-row')].some(r => r.style.display !== 'none');
        sec.style.display = visible ? '' : 'none';
      });
    };
    view.querySelector('#cat-filter').onchange = applyFilter;
    view.querySelector('#stock-filter').onchange = applyFilter;

    /* ---- Print ---- */
    view.querySelector('#btn-print').onclick = () => {
      const content = view.querySelector('#inv-print-area').innerHTML;
      const companyName = company.name || App.me.company.name;
      const w = window.open('', '_blank');
      w.document.write(`<!DOCTYPE html><html dir="${document.documentElement.dir}" lang="${document.documentElement.lang}">
        <head><meta charset="UTF-8"><title>${companyName} — ${t('inv_print_title')}</title>
        <style>
          body{font-family:system-ui,Arial,sans-serif;font-size:12px;color:#111;direction:${document.documentElement.dir};margin:16px}
          h1,h2,h3{margin:4px 0}
          table{width:100%;border-collapse:collapse;margin-bottom:12px}
          th,td{border:1px solid #ccc;padding:5px 8px;font-size:11px}
          thead th{background:#1a5276;color:#fff;font-weight:700}
          tfoot td{background:#f0f0f0;font-weight:700}
          .num,.money{text-align:${document.documentElement.dir==='rtl'?'left':'right'}}
          .muted{color:#666}.small{font-size:.85em}.mono{font-family:monospace}
          .badge{display:inline-block;padding:1px 7px;border-radius:10px;font-size:.8rem;font-weight:600;border:1px solid transparent}
          .badge.green{background:#d4edda;color:#155724;border-color:#c3e6cb}
          .badge.amber{background:#fff3cd;color:#856404;border-color:#ffeeba}
          .badge.red{background:#f8d7da;color:#721c24;border-color:#f5c6cb}
          .cat-section div[style*="background:var(--primary)"]{background:#1a5276!important;color:#fff;padding:5px 12px;font-weight:700;margin-bottom:4px;border-radius:4px;font-size:.9rem}
          @page{margin:10mm}
          @media print{
            .cat-section{page-break-inside:avoid}
            thead{display:table-header-group}
          }
        </style></head>
        <body>${content}</body></html>`);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);
    };
  },
};
