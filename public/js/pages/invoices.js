/* Invoices (sales) & Bills (purchases) — with cash/credit type, returns, and enhanced print */
function InvoicesPage(kind) {
  const isSale = kind === 'sale';
  return {
    title: () => t(isSale ? 'nav_invoices' : 'nav_bills'),
    async render(view) {
      const data = await api('/invoices?kind=' + kind);
      const bc = App.me.company.base_currency;

      // Include returns in list too
      const returnKind = isSale ? 'return_sale' : 'return_purchase';
      const allInvoices = data.invoices;
      const totalOut = allInvoices.filter(i => i.status !== 'paid' && i.kind === kind).reduce((s, i) => s + Math.max(0, i.total / i.fx_rate - i.paid_base), 0);

      view.innerHTML = `
        <div class="card">
          <div class="card-head">
            <h3>${esc(t(isSale ? 'nav_invoices' : 'nav_bills'))}</h3>
            <span class="badge primary">${esc(t(isSale ? 'inv_unpaid_total' : 'bill_unpaid_total'))}: ${fmtMoney(Math.max(0, totalOut), bc)}</span>
            <div class="spacer"></div>
            <div class="field" style="min-width:190px"><input id="f-search" placeholder="${esc(t('search'))}"></div>
            <div class="field" style="min-width:160px">
              <select id="f-type-filter">
                <option value="">${esc(t('inv_all_types'))}</option>
                <option value="${kind}">${esc(t('inv_regular'))}</option>
                <option value="${returnKind}">${esc(t('inv_returns'))}</option>
              </select>
            </div>
            <button class="btn primary" id="new-doc">${icon('plus')} ${esc(t(isSale ? 'inv_new' : 'bill_new'))}</button>
          </div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('inv_number'))}</th><th>${esc(t('inv_pay_type'))}</th><th>${esc(t('date'))}</th><th>${esc(t(isSale ? 'inv_contact' : 'bill_contact'))}</th>
              <th>${esc(t('currency'))}</th><th class="num">${esc(t('total'))}</th><th class="num">${esc(t('inv_paid_amt'))}</th><th class="num">${esc(t('inv_outstanding'))}</th><th>${esc(t('status'))}</th><th style="text-align:end">${esc(t('actions'))}</th></tr></thead>
            <tbody id="rows"></tbody>
          </table></div>
        </div>`;

      const tbody = view.querySelector('#rows');
      const draw = () => {
        const filter = view.querySelector('#f-search').value.toLowerCase();
        const typeFilter = view.querySelector('#f-type-filter').value;
        const rows = allInvoices.filter(i => {
          if (typeFilter && i.kind !== typeFilter) return false;
          if (!typeFilter && i.kind !== kind && i.kind !== returnKind) return false;
          return !filter || (i.number + ' ' + (i.contact_name || '')).toLowerCase().includes(filter);
        });
        tbody.innerHTML = rows.length ? rows.map(i => {
          const isReturn = i.kind === returnKind;
          const out = Math.max(0, i.total / i.fx_rate - (i.paid_base || 0));
          const payTypeLabel = i.payment_type === 'cash'
            ? `<span class="badge green">${esc(t('inv_cash'))}</span>`
            : `<span class="badge amber">${esc(t('inv_credit'))}</span>`;
          return `<tr data-id="${i.id}">
            <td class="mono"><a href="#" data-act="view">${esc(i.number)}</a>
              ${isReturn ? `<br><span class="badge red small">${esc(t('inv_return_badge'))}</span>` : ''}</td>
            <td>${payTypeLabel}</td>
            <td>${esc(fmtDate(i.date))}</td>
            <td><b>${esc(i.contact_name || '—')}</b></td>
            <td><span class="badge primary">${esc(i.currency)}</span></td>
            <td class="money">${fmtMoney(i.total / i.fx_rate, bc)}</td>
            <td class="money muted">${i.paid_base ? fmtMoney(i.paid_base, bc) : '—'}</td>
            <td class="money ${out > 0 ? '' : 'muted'}">${out > 0.005 ? fmtMoney(out, bc) : '—'}</td>
            <td>${badge(i.status)}</td>
            <td style="text-align:end;white-space:nowrap">
              <button class="btn sm ghost" data-act="view">${icon('eye')}</button>
              ${i.status === 'draft' ? `<button class="btn sm ghost" data-act="post" title="${esc(t('inv_post'))}">${icon('check')}</button>
                <button class="btn sm ghost" data-act="del">${icon('trash')}</button>` : ''}
              ${i.status !== 'draft' && i.status !== 'paid' && !isReturn ? `<button class="btn sm ghost" data-act="pay" title="${esc(t('inv_pay'))}">${icon('wallet')}</button>` : ''}
              ${i.status !== 'draft' && !isReturn ? `<button class="btn sm ghost" data-act="return" title="${esc(t('inv_make_return'))}">${icon('trending')}</button>` : ''}
            </td>
          </tr>`;
        }).join('') : `<tr><td colspan="10">${emptyState(t('noData'))}</td></tr>`;

        tbody.querySelectorAll('tr').forEach(tr => {
          const inv = rows.find(i => i.id === Number(tr.dataset.id));
          if (!inv) return;
          const viewBtn = tr.querySelector('[data-act=view]');
          if (viewBtn) viewBtn.onclick = e => { e.preventDefault(); this.viewDoc(inv.id); };
          tr.querySelectorAll('[data-act]').forEach(b => {
            if (b.dataset.act === 'view') return;
            b.onclick = async () => {
              const action = b.dataset.act;
              if (action === 'del') {
                if (!(await confirmDlg(t('inv_delete_q')))) return;
                try { await api('/invoices/' + inv.id, { method: 'DELETE' }); toast(t('toast_deleted')); this.render(view); }
                catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
              } else if (action === 'post') {
                if (!(await confirmDlg(t('inv_confirm_post')))) return;
                try { await api('/invoices/' + inv.id + '/post', { method: 'POST' }); toast(t('toast_posted')); this.render(view); }
                catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
              } else if (action === 'pay') {
                this.payModal(inv.id, () => this.render(view));
              } else if (action === 'return') {
                this.returnModal(inv, () => this.render(view));
              }
            };
          });
        });
      };

      draw();
      view.querySelector('#f-search').oninput = debounce(e => draw(), 200);
      view.querySelector('#f-type-filter').onchange = draw;
      view.querySelector('#new-doc').onclick = () => this.newDocModal(kind, () => this.render(view));
    },

    /* -------- New Invoice / Bill modal -------- */
    async newDocModal(kind2, refresh) {
      const isS = kind2 === 'sale';
      const [{ contacts }, { products }, { currencies }] = await Promise.all([
        api('/contacts?kind=' + (isS ? 'customer' : 'supplier')),
        api('/products'),
        api('/settings'),
      ]);
      const activeProducts = products.filter(p => p.is_active);
      const bc = App.me.company.base_currency;
      const taxEnabled = App.me.company.tax_enabled;
      const taxRate = App.me.company.tax_rate;

      modal({
        title: t(isS ? 'inv_new' : 'bill_new'), wide: true,
        onOpen(body, close) {
          body.innerHTML = `
            <div class="form-grid mb">
              <div class="field"><label>${esc(t(isS ? 'inv_customer' : 'bill_supplier'))} <span class="req">*</span></label>
                <select id="f-contact"><option value="">${esc(t('inv_choose_customer'))}</option>
                  ${contacts.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
              <div class="field"><label>${esc(t('date'))} <span class="req">*</span></label><input type="date" id="f-date" value="${todayISO()}"></div>
              <div class="field"><label>${esc(t('dueDate'))}</label><input type="date" id="f-due"></div>
              <div class="field"><label>${esc(t('inv_pay_type'))}</label>
                <select id="f-paytype">
                  <option value="credit">${esc(t('inv_credit'))}</option>
                  <option value="cash">${esc(t('inv_cash'))}</option>
                </select></div>
              <div class="field"><label>${esc(t('currency'))}</label>
                <select id="f-cur">${currencies.map(c => `<option value="${c.code}" ${c.code === bc ? 'selected' : ''}>${esc(c.code)}</option>`).join('')}</select></div>
              <div class="field"><label id="f-rate-lbl"></label><input type="number" step="0.0001" id="f-rate"></div>
              ${taxEnabled ? `<div class="field"><label>${esc(t('inv_tax_rate'))}</label><input type="number" step="0.01" id="f-tax" value="${taxRate}"></div>` : ''}
            </div>
            <div class="table-wrap"><table class="tbl" id="items-tbl">
              <thead><tr><th style="width:26%">${esc(t('inv_product'))}</th><th style="width:22%">${esc(t('description'))}</th>
                <th class="num" style="width:8%">${esc(t('qty'))}</th><th class="num" style="width:12%">${esc(t('price'))}</th>
                <th style="width:11%">${esc(t('currency'))}</th><th class="num" style="width:11%">${esc(t('total'))}</th><th></th></tr></thead>
              <tbody></tbody>
            </table></div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-top:14px">
              <button class="btn" id="add-item">${icon('plus')} ${esc(t('inv_add_item'))}</button>
              <div style="min-width:250px">
                <div class="flex" style="justify-content:space-between"><span class="muted">${esc(t('inv_subtotal'))}</span><b id="sum-sub">0</b></div>
                ${taxEnabled ? `<div class="flex" style="justify-content:space-between"><span class="muted" id="tax-lbl">${esc(t('inv_tax', { p: taxRate }))}</span><b id="sum-tax">0</b></div>` : ''}
                <div class="flex" style="justify-content:space-between;margin-top:6px;padding-top:6px;border-top:2px solid var(--border)"><b>${esc(t('inv_grand'))}</b><b id="sum-grand" style="font-size:16px">0</b></div>
              </div>
            </div>
            <div class="field mt"><label>${esc(t('notes'))}</label><input id="f-memo"></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
              <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
              <button class="btn" id="f-draft">${esc(t('draft'))}</button>
              <button class="btn primary" id="f-post">${icon('check')} ${esc(t('inv_post'))}</button>
            </div>`;

          const tbody = body.querySelector('#items-tbl tbody');
          const prodSel = (pid) => `<select class="sel-prod">
            <option value="">${esc(t('inv_service'))}</option>
            ${activeProducts.map(p => `<option value="${p.id}" ${String(p.id) === String(pid) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;

          const setRate = () => {
            const c = currencies.find(x => x.code === body.querySelector('#f-cur').value);
            body.querySelector('#f-rate').value = c ? c.rate : 1;
            body.querySelector('#f-rate-lbl').textContent = t('inv_fx', { cur: c ? c.code : '?', base: 1, baseCur: bc });
          };
          setRate();
          body.querySelector('#f-cur').onchange = setRate;
          body.querySelector('#f-contact').onchange = () => {
            const cid2 = Number(body.querySelector('#f-contact').value);
            const contact = contacts.find(x => x.id === cid2);
            if (contact && contact.currency) { body.querySelector('#f-cur').value = contact.currency; setRate(); recalc(); }
          };

          const recalc = () => {
            const docCur = body.querySelector('#f-cur').value;
            const docC = currencies.find(x => x.code === docCur);
            const docFx = docC ? docC.rate : 1;
            let base = 0;
            tbody.querySelectorAll('tr').forEach(tr => {
              const q = parseFloat(tr.querySelector('.in-q').value) || 0;
              const p = parseFloat(tr.querySelector('.in-p').value) || 0;
              const lc = tr.querySelector('.sel-lcur').value;
              const c = currencies.find(x => x.code === lc);
              const lfx = c ? c.rate : 1;
              tr.querySelector('.cell-amt').textContent = fmtMoney(q * p, lc);
              base += (q * p) / lfx;
            });
            const taxPct = parseFloat(body.querySelector('#f-tax')?.value) || 0;
            const taxBase = base * taxPct / 100;
            body.querySelector('#sum-sub').textContent = fmtMoney(base * docFx, docCur);
            if (body.querySelector('#sum-tax')) { body.querySelector('#sum-tax').textContent = fmtMoney(taxBase * docFx, docCur); body.querySelector('#tax-lbl').textContent = t('inv_tax', { p: taxPct }); }
            body.querySelector('#sum-grand').textContent = fmtMoney((base + taxBase) * docFx, docCur);
          };
          const curOpts = () => currencies.map(c => `<option value="${c.code}">${esc(c.code)}</option>`).join('');
          const addItem = (pid = '', lineCur = '') => {
            const tr = el(`<tr>
              <td>${prodSel(pid)}</td>
              <td><input class="in-desc" placeholder="${esc(t('inv_desc'))}"></td>
              <td><input class="in-q num" type="number" step="0.01" min="0" value="1" style="width:70px"></td>
              <td><input class="in-p num" type="number" step="0.01" min="0" style="width:90px"></td>
              <td><select class="sel-lcur" style="width:78px">${curOpts()}</select></td>
              <td class="money cell-amt">0</td>
              <td><button class="btn sm ghost del-item">${icon('trash')}</button></td>
            </tr>`);
            tr.querySelector('.sel-lcur').value = lineCur || body.querySelector('#f-cur').value;
            tr.querySelector('.sel-lcur').onchange = () => recalc();
            tr.querySelector('.sel-prod').onchange = () => {
              const p = activeProducts.find(x => x.id === Number(tr.querySelector('.sel-prod').value));
              const c = currencies.find(x => x.code === tr.querySelector('.sel-lcur').value);
              const fx = c ? c.rate : 1;
              if (p) { tr.querySelector('.in-desc').value = p.name; tr.querySelector('.in-p').value = (p.price * fx).toFixed(2); }
              else { tr.querySelector('.in-desc').value = ''; tr.querySelector('.in-p').value = ''; }
              recalc();
            };
            tr.querySelectorAll('.in-q, .in-p').forEach(inp => inp.oninput = recalc);
            tr.querySelector('.del-item').onclick = () => { tr.remove(); recalc(); };
            tbody.appendChild(tr);
            recalc();
          };
          body.querySelector('#add-item').onclick = () => addItem();
          addItem();
          if (body.querySelector('#f-tax')) body.querySelector('#f-tax').oninput = recalc;

          const collect = () => {
            const items = [...tbody.querySelectorAll('tr')].map(tr => {
              const lc = tr.querySelector('.sel-lcur').value;
              const c = currencies.find(x => x.code === lc);
              return { product_id: tr.querySelector('.sel-prod').value ? Number(tr.querySelector('.sel-prod').value) : null, description: tr.querySelector('.in-desc').value.trim(), qty: parseFloat(tr.querySelector('.in-q').value) || 0, unit_price: parseFloat(tr.querySelector('.in-p').value) || 0, currency: lc, fx_rate: c ? c.rate : 1 };
            }).filter(i => i.qty > 0 && i.unit_price > 0);
            return {
              contact_id: body.querySelector('#f-contact').value ? Number(body.querySelector('#f-contact').value) : null,
              date: body.querySelector('#f-date').value,
              due_date: body.querySelector('#f-due').value || null,
              payment_type: body.querySelector('#f-paytype').value,
              currency: body.querySelector('#f-cur').value,
              fx_rate: parseFloat(body.querySelector('#f-rate').value) || 1,
              tax_rate: body.querySelector('#f-tax') ? (parseFloat(body.querySelector('#f-tax').value) || 0) : 0,
              memo: body.querySelector('#f-memo').value.trim(),
              items,
            };
          };
          const submit = async (status) => {
            const payload = collect();
            if (!payload.contact_id) return toast(t('err_missing_fields'), 'err');
            if (!payload.items.length) return toast(t('err_missing_fields'), 'err');
            try {
              await api('/invoices', { method: 'POST', body: { ...payload, kind: kind2, status } });
              toast(status === 'posted' ? t('toast_posted') : t('toast_saved'));
              close(); refresh();
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
          body.querySelector('#f-cancel').onclick = close;
          body.querySelector('#f-draft').onclick = () => submit('draft');
          body.querySelector('#f-post').onclick = async () => { if (!(await confirmDlg(t('inv_confirm_post')))) return; submit('posted'); };
        },
      });
    },

    /* -------- View / Print Invoice -------- */
    async viewDoc(id) {
      const [{ invoice, items, payments }, settings] = await Promise.all([api('/invoices/' + id), api('/settings')]);
      const bc = App.me.company.base_currency;
      const company = settings.company;
      const isReturn = invoice.kind === 'return_sale' || invoice.kind === 'return_purchase';

      modal({
        title: `${invoice.number} — ${isReturn ? t('inv_return_badge') : (invoice.status === 'draft' ? t('draft') : invoice.status === 'paid' ? t('paid') : t('posted'))}`,
        wide: true,
        onOpen(body, close) {
          const payTypeLabel = invoice.payment_type === 'cash'
            ? `<span class="badge green">${esc(t('inv_cash'))}</span>`
            : `<span class="badge amber">${esc(t('inv_credit'))}</span>`;

          body.innerHTML = `
            <div class="print-area" id="print-area">
              <!-- Invoice Header -->
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px">
                <div>
                  <div style="font-size:1.4rem;font-weight:800;color:var(--primary)">${esc(company.name)}</div>
                  ${company.seller_name ? `<div style="font-size:.9rem;font-weight:600;margin-top:2px">${esc(t('inv_seller'))}: ${esc(company.seller_name)}</div>` : ''}
                  ${company.tax_no ? `<div class="muted small">${esc(t('set_tax_no'))}: ${esc(company.tax_no)}</div>` : ''}
                  ${company.phone ? `<div class="muted small">${esc(t('phone'))}: ${esc(company.phone)}</div>` : ''}
                  ${company.address ? `<div class="muted small">${esc(company.address)}</div>` : ''}
                </div>
                <div style="text-align:end">
                  <div style="font-size:1.3rem;font-weight:800" class="mono">${esc(invoice.number)}</div>
                  ${isReturn ? `<div><span class="badge red">${esc(t('inv_return_badge'))}</span></div>` : ''}
                  <div style="margin-top:4px">${payTypeLabel}</div>
                  <div class="muted small">${esc(t('date'))}: <b>${esc(fmtDate(invoice.date))}</b></div>
                  ${invoice.due_date ? `<div class="muted small">${esc(t('dueDate'))}: ${esc(fmtDate(invoice.due_date))}</div>` : ''}
                  <div class="muted small">${esc(t('currency'))}: ${esc(invoice.currency)}</div>
                </div>
              </div>
              <hr style="margin:0 0 16px;border-color:var(--border)">
              <!-- Items Table -->
              <div class="table-wrap"><table class="tbl">
                <thead><tr><th>${esc(t('inv_desc'))}</th><th class="num">${esc(t('qty'))}</th><th class="num">${esc(t('price'))}</th><th class="num">${esc(t('total'))} (${esc(invoice.currency)})</th></tr></thead>
                <tbody>
                  ${items.map(it => `<tr><td>${esc(it.description)}</td><td class="num">${fmtNum(it.qty)}</td>
                    <td class="num">${fmtNum(it.unit_price, 2)}</td><td class="num">${fmtNum(it.amount, 2)}</td></tr>`).join('')}
                </tbody>
                <tfoot>
                  <tr><td colspan="3">${esc(t('inv_subtotal'))}</td><td class="num">${fmtNum(invoice.subtotal, 2)}</td></tr>
                  ${invoice.tax_amount > 0 ? `<tr><td colspan="3">${esc(t('inv_tax', { p: Math.round(invoice.tax_amount / invoice.subtotal * 1000) / 10 }))}</td><td class="num">${fmtNum(invoice.tax_amount, 2)}</td></tr>` : ''}
                  <tr style="font-size:1.05rem"><td colspan="3"><b>${esc(t('inv_grand'))}</b></td><td class="num"><b>${fmtNum(invoice.total, 2)} ${esc(invoice.currency)}</b></td></tr>
                  <tr><td colspan="3" class="muted small">${esc(t('inv_grand'))} (${esc(bc)})</td><td class="num"><b>${fmtMoney(invoice.total / invoice.fx_rate, bc)}</b></td></tr>
                </tfoot>
              </table></div>
              ${payments.length ? `<h4 style="margin:14px 0 6px">${esc(t('inv_paid_amt'))}</h4>
                <table class="tbl"><tbody>${payments.map(p => `<tr><td>${esc(fmtDate(p.date))}</td>
                  <td class="money">${fmtMoney(p.base_amount, bc)}</td><td class="muted">${esc(p.memo)}</td>
                  <td class="muted small">${esc(p.account_name || '')}</td></tr>`).join('')}</tbody></table>` : ''}
              ${invoice.memo ? `<p class="muted small" style="margin-top:12px">${esc(invoice.memo)}</p>` : ''}
              <!-- Signature area -->
              <div style="display:flex;gap:40px;margin-top:32px;padding-top:16px;border-top:1px solid var(--border)">
                <div style="flex:1;text-align:center"><div style="border-top:1px solid #999;padding-top:6px;margin-top:40px;font-size:.8rem;color:var(--muted)">${esc(t('inv_sig_seller'))}</div></div>
                <div style="flex:1;text-align:center"><div style="border-top:1px solid #999;padding-top:6px;margin-top:40px;font-size:.8rem;color:var(--muted)">${esc(t('inv_sig_buyer'))}</div></div>
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
              <button class="btn" id="btn-print">${icon('file')} ${esc(t('print'))}</button>
              <button class="btn primary" id="f-close">${esc(t('close'))}</button>
            </div>`;

          body.querySelector('#f-close').onclick = close;
          body.querySelector('#btn-print').onclick = () => {
            const content = body.querySelector('#print-area').innerHTML;
            const w = window.open('', '_blank');
            w.document.write(`<!DOCTYPE html><html dir="${document.documentElement.dir}" lang="${document.documentElement.lang}">
              <head><meta charset="UTF-8"><title>${invoice.number}</title>
              <style>
                body{font-family:system-ui,Arial,sans-serif;font-size:13px;color:#111;direction:${document.documentElement.dir};margin:20px}
                table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px;font-size:12px}
                thead th{background:#f5f5f5;font-weight:700}tfoot td{font-weight:600;background:#fafafa}
                .num,.money{text-align:${document.documentElement.dir==='rtl'?'left':'right'}}
                .muted{color:#666}.small{font-size:.85em}.mono{font-family:monospace}
                .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:.8rem;font-weight:600}
                .badge.green{background:#dcfce7;color:#166534}.badge.amber{background:#fef3c7;color:#92400e}
                .badge.red{background:#fee2e2;color:#991b1b}
                @media print{body{margin:8px}}
              </style></head><body>${content}</body></html>`);
            w.document.close();
            w.focus();
            setTimeout(() => w.print(), 400);
          };
        },
      });
    },

    /* -------- Return/Refund Modal -------- */
    async returnModal(inv, refresh) {
      const { invoice, items } = await api('/invoices/' + inv.id);
      const bc = App.me.company.base_currency;
      modal({
        title: `${esc(t('inv_make_return'))} — ${esc(invoice.number)}`, wide: true,
        onOpen(body, close) {
          body.innerHTML = `
            <p class="muted small mb">${esc(t('inv_return_hint'))}</p>
            <div class="form-grid mb">
              <div class="field"><label>${esc(t('date'))} *</label><input type="date" id="ret-date" value="${todayISO()}"></div>
              <div class="field"><label>${esc(t('notes'))}</label><input id="ret-memo" placeholder="${esc(t('inv_return_memo_ph'))}"></div>
            </div>
            <div class="table-wrap"><table class="tbl">
              <thead><tr><th>${esc(t('inv_desc'))}</th><th class="num">${esc(t('inv_orig_qty'))}</th><th class="num">${esc(t('inv_return_qty'))}</th><th class="num">${esc(t('price'))}</th><th class="num">${esc(t('total'))}</th></tr></thead>
              <tbody>
                ${items.map((it, idx) => `<tr>
                  <td>${esc(it.description)}</td>
                  <td class="num">${fmtNum(it.qty)}</td>
                  <td><input type="number" class="ret-qty" data-idx="${idx}" data-id="${it.id}" step="0.01" min="0" max="${it.qty}" value="${it.qty}" style="width:80px;text-align:end"></td>
                  <td class="num">${fmtNum(it.unit_price, 2)}</td>
                  <td class="num ret-line-total">${fmtNum(it.amount, 2)}</td>
                </tr>`).join('')}
              </tbody>
            </table></div>
            <div style="text-align:end;margin-top:10px;font-size:1.1rem">
              ${esc(t('inv_return_total'))}: <b id="ret-total">${fmtMoney(invoice.total / invoice.fx_rate, bc)}</b>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
              <button class="btn" id="ret-cancel">${esc(t('cancel'))}</button>
              <button class="btn red" id="ret-save">${icon('trending')} ${esc(t('inv_confirm_return'))}</button>
            </div>`;

          // Recalc return total on qty change
          body.querySelectorAll('.ret-qty').forEach(inp => {
            inp.oninput = () => {
              const rows = [...body.querySelectorAll('.ret-qty')].map((el, i) => ({ qty: parseFloat(el.value) || 0, item: items[i] }));
              let total = 0;
              rows.forEach((r, i) => {
                const lineTotal = r.qty * items[i].unit_price;
                body.querySelectorAll('.ret-line-total')[i].textContent = fmtNum(lineTotal, 2);
                total += lineTotal / (invoice.fx_rate || 1);
              });
              body.querySelector('#ret-total').textContent = fmtMoney(total, bc);
            };
          });

          body.querySelector('#ret-cancel').onclick = close;
          body.querySelector('#ret-save').onclick = async () => {
            const date = body.querySelector('#ret-date').value;
            const memo = body.querySelector('#ret-memo').value.trim();
            const returnItems = [...body.querySelectorAll('.ret-qty')].map(el => ({
              invoice_item_id: Number(el.dataset.id),
              qty: parseFloat(el.value) || 0,
            })).filter(r => r.qty > 0);
            if (!date || !returnItems.length) return toast(t('err_missing_fields'), 'err');
            if (!(await confirmDlg(t('inv_confirm_return_q')))) return;
            try {
              const r = await api('/invoices/' + invoice.id + '/return', { method: 'POST', body: { date, memo, items: returnItems } });
              toast(t('inv_return_done', { no: r.invoice.number }));
              close(); refresh();
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
        },
      });
    },

    /* -------- Payment Modal -------- */
    async payModal(id, refresh) {
      const [{ invoice, payments }, s] = await Promise.all([api('/invoices/' + id), api('/settings')]);
      const bc = App.me.company.base_currency;
      const paid = payments.reduce((sum, p) => sum + p.base_amount, 0);
      const remaining = Math.max(0, invoice.total / invoice.fx_rate - paid);
      const cashAccounts = s.accounts.filter(a => a.code.startsWith('10'));
      const payAccounts = cashAccounts.length ? cashAccounts : s.accounts;
      modal({
        title: t('inv_pay_title', { no: invoice.number }),
        onOpen(body, close) {
          body.innerHTML = `
            <div class="summary-box mb">${esc(t('inv_outstanding'))}: <b>${fmtMoney(remaining, bc)}</b></div>
            <div class="form-grid">
              <div class="field"><label>${esc(t('inv_pay_date'))} *</label><input type="date" id="f-date" value="${todayISO()}"></div>
              <div class="field"><label>${esc(t('inv_pay_amount'))} (${esc(invoice.currency)}) *</label><input type="number" step="0.01" min="0.01" id="f-amount" value="${Math.round(invoice.total * 100) / 100}"></div>
              <div class="field" style="grid-column:1/-1"><label>${esc(t('inv_pay_account'))} *</label>
                <select id="f-account">${payAccounts.map(a => `<option value="${a.id}">${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select></div>
              <div class="field" style="grid-column:1/-1"><label>${esc(t('memo'))}</label><input id="f-memo"></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
              <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
              <button class="btn green" id="f-save">${icon('check')} ${esc(t('inv_pay'))}</button>
            </div>`;
          body.querySelector('#f-cancel').onclick = close;
          body.querySelector('#f-save').onclick = async () => {
            const amount = parseFloat(body.querySelector('#f-amount').value);
            if (!amount || !body.querySelector('#f-account').value) return toast(t('err_missing_fields'), 'err');
            try {
              await api('/invoices/' + id + '/pay', { method: 'POST', body: { date: body.querySelector('#f-date').value, amount, account_id: Number(body.querySelector('#f-account').value), memo: body.querySelector('#f-memo').value.trim() } });
              toast(t('toast_payment')); close(); refresh();
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
        },
      });
    },
  };
}
