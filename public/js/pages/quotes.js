/* Quotations (عروض الأسعار) — create, print, convert to invoice */
const QuotesPage = {
  title: () => t('nav_quotes'),

  async render(view) {
    const self = this;
    const { quotes } = await api('/quotes');
    const bc = App.me.company.base_currency;
    const statusBadge = (s) => {
      const map = { draft: 'draft', sent: 'primary', accepted: 'green', converted: 'gray' };
      return `<span class="badge ${map[s] || 'gray'}">${esc(t('qt_status_' + s) || s)}</span>`;
    };

    view.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>${esc(t('qt_list'))}</h3>
          <div class="spacer"></div>
          <button class="btn primary" id="new-q">${icon('plus')} ${esc(t('qt_new'))}</button></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('rep_number'))}</th><th>${esc(t('rep_date'))}</th><th>${esc(t('qt_customer'))}</th>
            <th>${esc(t('qt_valid_until'))}</th><th>${esc(t('rep_currency'))}</th><th class="num">${esc(t('rep_amount_base', { cur: bc }))}</th>
            <th>${esc(t('status'))}</th><th style="text-align:end">${esc(t('actions'))}</th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
      </div>`;

    const tbody = view.querySelector('#rows');
    tbody.innerHTML = quotes.length ? quotes.map(q => `
      <tr data-id="${q.id}">
        <td class="mono"><a href="#" data-act="view">${esc(q.number)}</a></td>
        <td>${esc(fmtDate(q.date))}</td>
        <td>${esc(q.contact_name || '—')}</td>
        <td>${esc(fmtDate(q.valid_until))}</td>
        <td class="muted">${esc(q.currency)}</td>
        <td class="money">${fmtMoney(q.total / q.fx_rate, bc)}</td>
        <td>${statusBadge(q.status)}</td>
        <td style="text-align:end;white-space:nowrap">
          <button class="btn sm ghost" data-act="view">${icon('eye')} ${esc(t('qt_view'))}</button>
          ${q.status !== 'converted' ? `<button class="btn sm ghost" data-act="convert" title="${esc(t('qt_convert'))}">${icon('check')}</button>` : ''}
          ${q.status === 'draft' ? `<button class="btn sm ghost" data-act="del">${icon('trash')}</button>` : ''}
        </td>
      </tr>`).join('') : `<tr><td colspan="8">${emptyState(t('noData'))}</td></tr>`;

    tbody.querySelectorAll('tr').forEach(tr => {
      const q = quotes.find(x => x.id === Number(tr.dataset.id));
      if (!q) return;
      const viewBtn = tr.querySelector('[data-act=view]');
      if (viewBtn) viewBtn.onclick = e => { e.preventDefault(); self.viewQuote(q.id); };
      tr.querySelectorAll('[data-act]').forEach(b => {
        if (b.dataset.act === 'view') return;
        b.onclick = async () => {
          try {
            if (b.dataset.act === 'del') {
              if (!(await confirmDlg(t('qt_delete_q')))) return;
              await api('/quotes/' + q.id, { method: 'DELETE' });
              toast(t('toast_deleted'));
              self.render(view);
            } else if (b.dataset.act === 'convert') {
              if (!(await confirmDlg(t('qt_convert_confirm')))) return;
              const r = await api('/quotes/' + q.id + '/convert', { method: 'POST' });
              toast(t('qt_converted_note', { no: r.invoice.number }));
              self.render(view);
            }
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      });
    });

    view.querySelector('#new-q').onclick = () => self.newQuoteModal(() => self.render(view));
  },

  async newQuoteModal(refresh) {
    const self = this;
    const [{ contacts }, { products }, { currencies }] = await Promise.all([
      api('/contacts?kind=customer'), api('/products'), api('/settings'),
    ]);
    const customers = contacts.filter(c => c.kind === 'customer');
    const activeProducts = products.filter(p => p.is_active);
    const bc = App.me.company.base_currency;
    const taxEnabled = App.me.company.tax_enabled;
    const taxRate = App.me.company.tax_rate;

    const m = modal({
      title: t('qt_new'), wide: true,
      onOpen(body, close) {
        body.innerHTML = `
          <div class="form-grid mb">
            <div class="field"><label>${esc(t('qt_customer'))} *</label>
              <select id="f-contact"><option value="">${esc(t('inv_choose_customer'))}</option>
                ${customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label>${esc(t('rep_date'))} *</label><input type="date" id="f-date" value="${todayISO()}"></div>
            <div class="field"><label>${esc(t('qt_valid_until'))}</label><input type="date" id="f-valid" value="${new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10)}"></div>
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
            <button class="btn primary" id="f-save">${icon('check')} ${esc(t('qt_save'))}</button>
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

        // billing currency defaults to the customer's preferred currency
        body.querySelector('#f-contact').onchange = () => {
          const cid = Number(body.querySelector('#f-contact').value);
          const contact = customers.find(x => x.id === cid);
          if (contact && contact.currency) {
            body.querySelector('#f-cur').value = contact.currency;
            setRate();
            recalc();
          }
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
          if (body.querySelector('#sum-tax')) {
            body.querySelector('#sum-tax').textContent = fmtMoney(taxBase * docFx, docCur);
            body.querySelector('#tax-lbl').textContent = t('inv_tax', { p: taxPct });
          }
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
          tr.querySelector('.sel-lcur').onchange = () => {
            const c = currencies.find(x => x.code === tr.querySelector('.sel-lcur').value);
            const fx = c ? c.rate : 1;
            const prod = activeProducts.find(x => x.id === Number(tr.querySelector('.sel-prod').value));
            if (prod) tr.querySelector('.in-p').value = (prod.price * fx).toFixed(2);
            recalc();
          };
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

        body.querySelector('#f-cancel').onclick = close;
        body.querySelector('#f-save').onclick = async () => {
          const items = [...tbody.querySelectorAll('tr')].map(tr => {
            const lc = tr.querySelector('.sel-lcur').value;
            const c = currencies.find(x => x.code === lc);
            return {
              product_id: tr.querySelector('.sel-prod').value ? Number(tr.querySelector('.sel-prod').value) : null,
              description: tr.querySelector('.in-desc').value.trim(),
              qty: parseFloat(tr.querySelector('.in-q').value) || 0,
              unit_price: parseFloat(tr.querySelector('.in-p').value) || 0,
              currency: lc,
              fx_rate: c ? c.rate : 1,
            };
          }).filter(i => i.qty > 0 && i.unit_price > 0);
          const payload = {
            contact_id: body.querySelector('#f-contact').value ? Number(body.querySelector('#f-contact').value) : null,
            date: body.querySelector('#f-date').value,
            valid_until: body.querySelector('#f-valid').value || null,
            currency: body.querySelector('#f-cur').value,
            fx_rate: parseFloat(body.querySelector('#f-rate').value) || 1,
            tax_rate: body.querySelector('#f-tax') ? (parseFloat(body.querySelector('#f-tax').value) || 0) : 0,
            memo: body.querySelector('#f-memo').value.trim(),
            items,
          };
          if (!payload.contact_id || !payload.items.length) return toast(t('err_missing_fields'), 'err');
          try {
            await api('/quotes', { method: 'POST', body: payload });
            toast(t('toast_saved'));
            close();
            refresh();
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },

  async viewQuote(id) {
    const { quote, items, contact } = await api('/quotes/' + id);
    const bc = App.me.company.base_currency;
    const m = modal({
      title: `${quote.number} — ${t('qt_status_' + quote.status)}`,
      wide: true,
      onOpen(body, close) {
        body.innerHTML = `
          <div class="print-area">
            <div class="rep-header">
              <div><b style="font-size:16px">${esc(App.me.company.name)}</b><br><span class="muted small">${esc(t('appName'))}</span></div>
              <div class="text-right"><b>${esc(t('qt_quotation'))} — ${esc(quote.number)}</b><br>
                <span class="muted small">${esc(t('rep_date'))}: ${esc(fmtDate(quote.date))}</span><br>
                <span class="muted small">${esc(t('qt_valid_until'))}: ${esc(fmtDate(quote.valid_until))}</span></div>
            </div>
            <div class="rep-contact">
              ${contact ? `<b>${esc(contact.name)}</b><br><span class="muted small">${esc(contact.email || '')} · ${esc(contact.phone || '')} · ${esc(contact.address || '')}</span>` : ''}
            </div>
            <div class="table-wrap"><table class="tbl">
              <thead><tr><th>${esc(t('inv_desc'))}</th><th class="num">${esc(t('qty'))}</th><th class="num">${esc(t('price'))}</th><th class="num">${esc(t('total'))} (${esc(quote.currency)})</th></tr></thead>
              <tbody>
                ${items.map(it => `<tr><td>${esc(it.description)}</td><td class="num">${fmtNum(it.qty)}</td>
                  <td class="num">${fmtNum(it.unit_price, 2)}</td><td class="num">${fmtNum(it.amount, 2)}</td></tr>`).join('')}
              </tbody>
              <tfoot>
                <tr><td colspan="3">${esc(t('inv_subtotal'))}</td><td class="num">${fmtNum(quote.subtotal, 2)}</td></tr>
                ${quote.tax_amount > 0 ? `<tr><td colspan="3">${esc(t('inv_tax', { p: 0 }))}</td><td class="num">${fmtNum(quote.tax_amount, 2)}</td></tr>` : ''}
                <tr><td colspan="3">${esc(t('inv_grand'))}</td><td class="num"><b>${fmtNum(quote.total, 2)} ${esc(quote.currency)}</b></td></tr>
                <tr><td colspan="3" class="muted small">${esc(t('inv_grand'))} (${esc(bc)})</td><td class="num"><b>${fmtMoney(quote.total / quote.fx_rate, bc)}</b></td></tr>
              </tfoot>
            </table></div>
            ${quote.memo ? `<p class="muted small mt">${esc(quote.memo)}</p>` : ''}
            <p class="muted small mt">${esc(t('qt_thanks'))}</p>
            <div class="rep-sign">${esc(t('rep_signature'))} ____________</div>
          </div>
          <div class="rep-actions no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap">
            ${quote.status === 'draft' ? `<button class="btn" id="q-sent">${esc(t('qt_mark_sent'))}</button>` : ''}
            ${quote.status === 'sent' ? `<button class="btn" id="q-accept">${esc(t('qt_mark_accepted'))}</button>` : ''}
            ${quote.status !== 'converted' ? `<button class="btn green" id="q-convert">${icon('check')} ${esc(t('qt_convert'))}</button>` : ''}
            <button class="btn" onclick="window.print()">${icon('file')} ${esc(t('rep_print'))}</button>
            <button class="btn primary" id="f-close">${esc(t('close'))}</button>
          </div>`;
        body.querySelector('#f-close').onclick = close;
        const setStatus = (st) => async () => {
          await api('/quotes/' + id, { method: 'PUT', body: { status: st } });
          close();
          toast(t('toast_updated'));
          window.location.hash = '#/quotes';
          setTimeout(() => window.location.reload(), 50);
        };
        const s1 = body.querySelector('#q-sent'); if (s1) s1.onclick = setStatus('sent');
        const s2 = body.querySelector('#q-accept'); if (s2) s2.onclick = setStatus('accepted');
        const cv = body.querySelector('#q-convert');
        if (cv) cv.onclick = async () => {
          if (!(await confirmDlg(t('qt_convert_confirm')))) return;
          const r = await api('/quotes/' + id + '/convert', { method: 'POST' });
          toast(t('qt_converted_note', { no: r.invoice.number }));
          close();
          window.location.hash = '#/quotes';
          setTimeout(() => window.location.reload(), 50);
        };
      },
    });
  },
};
