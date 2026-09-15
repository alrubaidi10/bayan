/* Debts — receivables (customers owe us) & payables (we owe suppliers) */
const DebtsPage = {
  title: () => t('debts_title'),

  async render(view) {
    const self = this;
    const data = await api('/debts');
    const bc = App.me.company.base_currency;

    view.innerHTML = `
      <div class="kpi-grid mb" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <div class="kpi red">
          <div class="k-label">${icon('users')} ${esc(t('debts_ar'))}</div>
          <div class="k-value">${fmtMoney(data.totalAR, bc)}</div>
          <div class="k-sub">${data.ar.length} ${esc(t('inv_contact'))}</div>
        </div>
        <div class="kpi amber">
          <div class="k-label">${icon('building')} ${esc(t('debts_ap'))}</div>
          <div class="k-value">${fmtMoney(data.totalAP, bc)}</div>
          <div class="k-sub">${data.ap.length} ${esc(t('bill_supplier'))}</div>
        </div>
      </div>
      <div class="card">
        <div class="tabbar" id="debt-tabs">
          <button class="tab active" data-tab="ar">${esc(t('debts_ar'))}</button>
          <button class="tab" data-tab="ap">${esc(t('debts_ap'))}</button>
        </div>
        <div id="debt-body"></div>
      </div>`;

    const tabs = view.querySelector('#debt-tabs');
    const body = view.querySelector('#debt-body');

    const showInvoices = async (contactId, tab) => {
      const d = await api('/statement?contact_id=' + contactId);
      const m = modal({
        title: `${t('debts_invoices')} — ${d.contact.name}`, wide: true,
        onOpen(b2, close2) {
          b2.innerHTML = `
            <div class="summary-box mb">${esc(t('rep_outstanding'))}: <b style="color:var(--red)">${fmtMoney(d.totals.outstanding, bc)}</b></div>
            <div class="table-wrap"><table class="tbl">
              <thead><tr><th>${esc(t('rep_number'))}</th><th>${esc(t('rep_date'))}</th>
                <th class="num">${esc(t('rep_amount_base', { cur: bc }))}</th><th class="num">${esc(t('rep_paid'))}</th>
                <th class="num">${esc(t('rep_outstanding'))}</th><th style="text-align:end"></th></tr></thead>
              <tbody>
                ${d.invoices.filter(i => i.outstanding > 0.005).map(i => `
                  <tr data-inv="${i.id}">
                    <td class="mono">${esc(i.number)}</td><td>${esc(fmtDate(i.date))}</td>
                    <td class="money">${fmtMoney(i.total_base, bc)}</td>
                    <td class="money muted">${fmtMoney(i.paid_base, bc)}</td>
                    <td class="money" style="color:var(--red)">${fmtMoney(i.outstanding, bc)}</td>
                    <td style="text-align:end"><button class="btn sm green" data-act="pay">${icon('wallet')} ${esc(t('debts_pay'))}</button></td>
                  </tr>`).join('') || `<tr><td colspan="6">${emptyState(t('debts_no_debts'))}</td></tr>`}
              </tbody>
            </table></div>`;
          b2.querySelectorAll('[data-act=pay]').forEach(btn => {
            btn.onclick = () => {
              const invId = Number(btn.closest('tr').dataset.inv);
              self.payModal(invId, () => { close2(); self.render(view); });
            };
          });
        },
      });
    };

    const draw = (tab) => {
      tabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      const list = tab === 'ar' ? data.ar : data.ap;
      const rd = (x) => Math.round(x * 100) / 100;
      const tBilled = rd(list.reduce((s, c) => s + c.billed, 0));
      const tPaid = rd(list.reduce((s, c) => s + c.paid, 0));
      const tOut = rd(list.reduce((s, c) => s + c.outstanding, 0));
      body.innerHTML = `
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('name'))}</th><th class="num">${esc(t('debts_billed'))}</th>
            <th class="num">${esc(t('rep_paid'))}</th><th class="num">${esc(t('rep_outstanding'))}</th><th style="text-align:end">${esc(t('actions'))}</th></tr></thead>
          <tbody>
            ${list.length ? list.map(c => `
              <tr data-cid="${c.contact_id}">
                <td><b>${esc(c.name)}</b>${c.currency ? ` <span class="badge gray">${esc(c.currency)}</span>` : ''}
                  <br><span class="muted small">${esc(c.email || c.phone || '')}</span></td>
                <td class="money">${fmtMoney(c.billed, bc)}</td>
                <td class="money muted">${fmtMoney(c.paid, bc)}</td>
                <td class="money" style="color:var(--red)">${fmtMoney(c.outstanding, bc)}</td>
                <td style="text-align:end"><button class="btn sm ghost" data-act="inv">${icon('file')} ${esc(t('debts_invoices'))}</button></td>
              </tr>`).join('')
            : `<tr><td colspan="5">${emptyState(t('debts_no_debts'))}</td></tr>`}
          </tbody>
          <tfoot><tr><td>${esc(t('rep_total'))}</td>
            <td class="money">${fmtMoney(tBilled, bc)}</td>
            <td class="money">${fmtMoney(tPaid, bc)}</td>
            <td class="money">${fmtMoney(tOut, bc)}</td><td></td></tr></tfoot>
        </table></div>`;
      body.querySelectorAll('[data-act=inv]').forEach(btn => {
        btn.onclick = () => showInvoices(Number(btn.closest('tr').dataset.cid), tab);
      });
    };
    tabs.querySelectorAll('.tab').forEach(b => b.onclick = () => draw(b.dataset.tab));
    draw('ar');
  },

  payModal(invId, onDone) {
    Promise.all([api('/invoices/' + invId), api('/settings')]).then(([{ invoice, payments }, s]) => {
      const bc = App.me.company.base_currency;
      const paid = payments.reduce((x, p) => x + p.base_amount, 0);
      const remaining = Math.max(0, invoice.total / invoice.fx_rate - paid);
      const cashAccounts = s.accounts.filter(a => a.code.startsWith('10'));
      const payAccounts = (cashAccounts.length ? cashAccounts : s.accounts);
      const m = modal({
        title: t('inv_pay_title', { no: invoice.number }),
        onOpen(body, close) {
          body.innerHTML = `
            <div class="summary-box mb">${esc(t('inv_outstanding'))}: <b>${fmtMoney(remaining, bc)}</b></div>
            <div class="form-grid">
              <div class="field"><label>${esc(t('inv_pay_date'))} *</label><input type="date" id="f-date" value="${todayISO()}"></div>
              <div class="field"><label>${esc(t('inv_pay_amount'))} (${esc(invoice.currency)}) *</label>
                <input type="number" step="0.01" min="0.01" id="f-amount" value="${Math.round(invoice.total * 100) / 100}"></div>
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
              await api('/invoices/' + invId + '/pay', {
                method: 'POST',
                body: {
                  date: body.querySelector('#f-date').value,
                  amount,
                  account_id: Number(body.querySelector('#f-account').value),
                  memo: body.querySelector('#f-memo').value.trim(),
                },
              });
              toast(t('toast_payment'));
              close();
              onDone();
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
        },
      });
    });
  },
};
