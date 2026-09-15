/* Reports hub: sales invoices, purchase bills, expenses, customer/supplier statement — all printable */
const ReportsPage = {
  title: () => t('rep_title'),

  async render(view) {
    const self = this;
    const bc = App.me.company.base_currency;
    const [{ invoices: sales }, { invoices: bills }, { expenses }, { contacts }, { accounts }] = await Promise.all([
      api('/invoices?kind=sale'), api('/invoices?kind=purchase'), api('/expenses'),
      api('/contacts'), api('/accounts'),
    ]);
    const customers = contacts.filter(c => c.kind === 'customer');
    const suppliers = contacts.filter(c => c.kind === 'supplier');
    const expenseAccounts = accounts.filter(a => a.type === 'expense');

    view.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h3>${esc(t('rep_title'))}</h3>
          <div class="spacer"></div>
          <span class="badge primary">${esc(App.me.company.name)}</span>
        </div>
        <div class="tabbar" id="tabbar">
          <button class="tab active" data-tab="sales">${esc(t('rep_sales'))}</button>
          <button class="tab" data-tab="purchases">${esc(t('rep_purchases'))}</button>
          <button class="tab" data-tab="expenses">${esc(t('rep_expenses'))}</button>
          <button class="tab" data-tab="statement">${esc(t('rep_statement'))}</button>
        </div>
        <div class="card-body" id="tab-body"></div>
      </div>`;

    const tabbar = view.querySelector('#tabbar');
    const body = view.querySelector('#tab-body');

    const fmtBase = (n) => fmtMoney(n, bc);
    const headerBlock = (title) => `
      <div class="rep-header">
        <div><b style="font-size:16px">${esc(App.me.company.name)}</b><br><span class="muted small">${esc(t('appName'))}</span></div>
        <div class="text-right"><b>${esc(title)}</b><br><span class="muted small">${esc(fmtDate(todayISO()))}</span></div>
      </div>`;

    /* ---------- generic document report ---------- */
    const docReport = (rows, opts) => {
      const filtered = rows.filter(r => {
        if (opts.from && r.date < opts.from) return false;
        if (opts.to && r.date > opts.to) return false;
        if (opts.contactId && r.contact_id !== opts.contactId) return false;
        return true;
      });
      const total = filtered.reduce((s, r) => s + r.total / r.fx_rate, 0);
      const paid = filtered.reduce((s, r) => s + (r.paid_base || 0), 0);
      body.innerHTML = `
        <div class="rep-filters">
          <div class="field"><label>${esc(t('rep_from'))}</label><input type="date" id="rf-from" value="${opts.from || ''}"></div>
          <div class="field"><label>${esc(t('rep_to'))}</label><input type="date" id="rf-to" value="${opts.to || ''}"></div>
          ${opts.contactOptions ? `<div class="field"><label>${esc(opts.contactLabel)}</label><select id="rf-contact">
            <option value="">${esc(opts.contactOptions.length ? opts.contactOptions[0].allLabel : '')}</option>
            ${opts.contactOptions.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>` : ''}
          <button class="btn" id="rf-apply">${esc(t('rep_generate'))}</button>
          <div class="spacer"></div>
          <button class="btn primary" id="rf-print">${icon('file')} ${esc(t('rep_print'))}</button>
        </div>
        <div class="rep-summary">
          <span>${esc(t('rep_total_docs', { n: filtered.length }))}</span>
          <span>${esc(t('rep_total'))}: <b>${fmtBase(total)}</b></span>
          ${opts.showPaid ? `<span>${esc(t('rep_paid'))}: <b>${fmtBase(paid)}</b></span>
            <span>${esc(t('rep_outstanding'))}: <b>${fmtBase(total - paid)}</b></span>` : ''}
        </div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('rep_number'))}</th><th>${esc(t('rep_date'))}</th><th>${esc(opts.contactLabel)}</th>
            <th>${esc(t('rep_currency'))}</th><th class="num">${esc(t('rep_amount_base', { cur: bc }))}</th>
            ${opts.showPaid ? `<th class="num">${esc(t('rep_paid'))}</th><th class="num">${esc(t('rep_outstanding'))}</th>` : ''}
            <th>${esc(t('rep_status'))}</th></tr></thead>
          <tbody>
            ${filtered.length ? filtered.map(r => `
              <tr><td class="mono">${esc(r.number)}</td><td>${esc(fmtDate(r.date))}</td>
                <td>${esc(r.contact_name || '—')}</td><td class="muted">${esc(r.currency)}</td>
                <td class="money">${fmtBase(r.total / r.fx_rate)}</td>
                ${opts.showPaid ? `<td class="money">${r.paid_base ? fmtBase(r.paid_base) : '—'}</td>
                  <td class="money">${fmtBase(r.total / r.fx_rate - (r.paid_base || 0))}</td>` : ''}
                <td>${badge(r.status)}</td></tr>`).join('')
            : `<tr><td colspan="${opts.showPaid ? 8 : 6}">${emptyState(t('rep_no_results'))}</td></tr>`}
          </tbody>
          <tfoot><tr><td colspan="${opts.showPaid ? 4 : 3}">${esc(t('rep_total'))}</td>
            <td class="money">${fmtBase(total)}</td>
            ${opts.showPaid ? `<td class="money">${fmtBase(paid)}</td><td class="money">${fmtBase(total - paid)}</td><td></td>` : `<td></td>`}</tr></tfoot>
        </table></div>`;
      body.querySelector('#rf-apply').onclick = () => {
        opts.from = body.querySelector('#rf-from').value;
        opts.to = body.querySelector('#rf-to').value;
        opts.contactId = body.querySelector('#rf-contact') ? Number(body.querySelector('#rf-contact').value) || null : null;
        docReport(rows, opts);
      };
      body.querySelector('#rf-print').onclick = () => self.printModal(
        headerBlock(opts.title) +
        `<div class="rep-filters print-filters"><span class="muted small">${esc(t('rep_from'))}: ${esc(opts.from || '…')} · ${esc(t('rep_to'))}: ${esc(opts.to || '…')}</span></div>` +
        body.querySelector('.table-wrap').outerHTML
      );
    };

    /* ---------- expense report ---------- */
    const expReport = () => {
      const from = body.querySelector('#ef-from').value;
      const to = body.querySelector('#ef-to').value;
      const accId = body.querySelector('#ef-account') ? Number(body.querySelector('#ef-account').value) || null : null;
      const rows = expenses.filter(e => {
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        if (accId && e.account_id !== accId) return false;
        return true;
      });
      const total = rows.reduce((s, e) => s + e.base_amount, 0);
      body.querySelector('#exp-body').innerHTML = `
        <div class="rep-summary"><span>${esc(t('rep_total_docs', { n: rows.length }))}</span>
          <span>${esc(t('rep_total'))}: <b>${fmtBase(total)}</b></span></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('rep_date'))}</th><th>${esc(t('memo'))}</th><th>${esc(t('exp_account'))}</th>
            <th>${esc(t('rep_currency'))}</th><th class="num">${esc(t('amount'))} (${esc(bc)})</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(e => `<tr><td>${esc(fmtDate(e.date))}</td><td>${esc(e.memo) || '—'}</td>
              <td>${esc(e.account_name)}</td><td class="muted">${esc(e.currency)}</td>
              <td class="money">${fmtBase(e.base_amount)}</td></tr>`).join('')
            : `<tr><td colspan="5">${emptyState(t('rep_no_results'))}</td></tr>`}
          </tbody>
          <tfoot><tr><td colspan="4">${esc(t('rep_total'))}</td><td class="money">${fmtBase(total)}</td></tr></tfoot>
        </table></div>`;
      const printRows = body.querySelector('#exp-body');
      body.querySelector('#ef-print').onclick = () => self.printModal(
        headerBlock(t('rep_expenses')) +
        `<div class="rep-filters print-filters"><span class="muted small">${esc(t('rep_from'))}: ${esc(from || '…')} · ${esc(t('rep_to'))}: ${esc(to || '…')}</span></div>` +
        printRows.innerHTML
      );
    };

    /* ---------- statement ---------- */
    const statement = async () => {
      const kindSel = body.querySelector('#st-kind').value; // customer | supplier
      const contactSel = body.querySelector('#st-contact');
      const cid = contactSel.value ? Number(contactSel.value) : null;
      const from = body.querySelector('#st-from').value;
      const to = body.querySelector('#st-to').value;
      if (!cid) { body.querySelector('#st-body').innerHTML = emptyState(t('rep_statement')); return; }
      const d = await api(`/statement?contact_id=${cid}&from=${from || ''}&to=${to || ''}`);
      const ttl = d.totals;
      body.querySelector('#st-body').innerHTML = `
        <div class="rep-summary">
          <span>${esc(t('rep_statement_for', { name: d.contact.name }))}</span>
          <span>${esc(t('rep_total'))}: <b>${fmtBase(ttl.total)}</b></span>
          <span>${esc(t('rep_paid'))}: <b>${fmtBase(ttl.paid)}</b></span>
          <span>${esc(t('rep_outstanding'))}: <b>${fmtBase(ttl.outstanding)}</b></span>
        </div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('rep_number'))}</th><th>${esc(t('rep_date'))}</th><th class="num">${esc(t('rep_amount_base', { cur: bc }))}</th>
            <th class="num">${esc(t('rep_paid'))}</th><th class="num">${esc(t('rep_outstanding'))}</th><th>${esc(t('rep_status'))}</th></tr></thead>
          <tbody>
            ${d.invoices.length ? d.invoices.map(r => `<tr><td class="mono">${esc(r.number)}</td><td>${esc(fmtDate(r.date))}</td>
              <td class="money">${fmtBase(r.total_base)}</td><td class="money">${r.paid_base ? fmtBase(r.paid_base) : '—'}</td>
              <td class="money">${fmtBase(r.outstanding)}</td><td>${badge(r.status)}</td></tr>`).join('')
            : `<tr><td colspan="6">${emptyState(t('rep_no_results'))}</td></tr>`}
          </tbody>
          <tfoot><tr><td colspan="2">${esc(t('rep_total'))}</td><td class="money">${fmtBase(ttl.total)}</td>
            <td class="money">${fmtBase(ttl.paid)}</td><td class="money">${fmtBase(ttl.outstanding)}</td><td></td></tr></tfoot>
        </table></div>`;
      body.querySelector('#st-print').onclick = () => self.printModal(
        headerBlock(t('rep_statement_kind') + ' — ' + d.contact.name) +
        `<div class="rep-filters print-filters"><span class="muted small">${esc(d.contact.name)} · ${esc(d.contact.email || '')} · ${esc(t('rep_from'))}: ${esc(from || '…')} · ${esc(t('rep_to'))}: ${esc(to || '…')}</span></div>` +
        body.querySelector('#st-body .table-wrap').outerHTML
      );
    };

    const drawTab = (tab) => {
      tabbar.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      if (tab === 'sales') {
        docReport(sales, {
          title: t('rep_sales'), showPaid: true,
          contactLabel: t('rep_customer'),
          contactOptions: [{ id: 0, allLabel: t('rep_all_customers') }, ...customers],
        });
      } else if (tab === 'purchases') {
        docReport(bills, {
          title: t('rep_purchases'), showPaid: true,
          contactLabel: t('rep_supplier'),
          contactOptions: [{ id: 0, allLabel: t('rep_all_suppliers') }, ...suppliers],
        });
      } else if (tab === 'expenses') {
        body.innerHTML = `
          <div class="rep-filters">
            <div class="field"><label>${esc(t('rep_from'))}</label><input type="date" id="ef-from" value="${new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)}"></div>
            <div class="field"><label>${esc(t('rep_to'))}</label><input type="date" id="ef-to" value="${todayISO()}"></div>
            <div class="field"><label>${esc(t('exp_account'))}</label><select id="ef-account">
              <option value="">${esc(t('all'))}</option>
              ${expenseAccounts.map(a => `<option value="${a.id}">${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select></div>
            <button class="btn" id="ef-apply">${esc(t('rep_generate'))}</button>
            <div class="spacer"></div>
            <button class="btn primary" id="ef-print">${icon('file')} ${esc(t('rep_print'))}</button>
          </div>
          <div id="exp-body"></div>`;
        body.querySelector('#ef-apply').onclick = expReport;
        expReport();
      } else if (tab === 'statement') {
        body.innerHTML = `
          <div class="rep-filters">
            <div class="field"><label>${esc(t('rep_statement_kind'))}</label>
              <select id="st-kind"><option value="customer">${esc(t('rep_customer'))}</option><option value="supplier">${esc(t('rep_supplier'))}</option></select></div>
            <div class="field"><label>${esc(t('name'))}</label><select id="st-contact"></select></div>
            <div class="field"><label>${esc(t('rep_from'))}</label><input type="date" id="st-from"></div>
            <div class="field"><label>${esc(t('rep_to'))}</label><input type="date" id="st-to" value="${todayISO()}"></div>
            <button class="btn" id="st-apply">${esc(t('rep_generate'))}</button>
            <div class="spacer"></div>
            <button class="btn primary" id="st-print">${icon('file')} ${esc(t('rep_print'))}</button>
          </div>
          <div id="st-body"></div>`;
        const fillContacts = () => {
          const list = body.querySelector('#st-kind').value === 'customer' ? customers : suppliers;
          body.querySelector('#st-contact').innerHTML = `<option value="">— ${esc(t('inv_choose_customer'))} —</option>` +
            list.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
        };
        body.querySelector('#st-kind').onchange = () => { fillContacts(); statement(); };
        body.querySelector('#st-contact').onchange = statement;
        body.querySelector('#st-apply').onclick = statement;
        fillContacts();
        statement();
      }
    };
    tabbar.querySelectorAll('.tab').forEach(btn => btn.onclick = () => drawTab(btn.dataset.tab));
    drawTab('sales');
  },

  /* Print-friendly modal: shows content and prints only it */
  printModal(contentHtml) {
    const m = modal({
      title: t('rep_preview'), wide: true,
      onOpen(body, close) {
        body.innerHTML = `
          <div class="print-area">${contentHtml}
            <div class="rep-sign">${esc(t('rep_signature'))} ____________</div>
          </div>
          <div class="rep-actions no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
            <button class="btn" onclick="window.print()">${icon('file')} ${esc(t('rep_print'))}</button>
            <button class="btn primary" id="pf-close">${esc(t('close'))}</button>
          </div>`;
        body.querySelector('#pf-close').onclick = close;
      },
    });
  },
};
