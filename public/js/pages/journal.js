/* Journal Entries */
const JournalPage = {
  title: () => t('nav_journal'),
  async render(view) {
    const { entries } = await api('/journal?limit=200');
    view.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>${esc(t('nav_journal'))}</h3>
          <span class="muted small">${entries.length} ${esc(t('je_line_count'))}</span>
          <div class="spacer"></div>
          <button class="btn primary" id="new-je">${icon('plus')} ${esc(t('je_new'))}</button></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('reference'))}</th><th>${esc(t('date'))}</th><th>${esc(t('memo'))}</th><th>${esc(t('je_source'))}</th><th class="num">${esc(t('je_debit'))}</th><th class="num">${esc(t('je_credit'))}</th><th style="text-align:end">${esc(t('actions'))}</th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
      </div>`;

    const rows = view.querySelector('#rows');
    const srcBadge = (s) => `<span class="badge gray">${esc(t('source_' + s) || s)}</span>`;
    rows.innerHTML = entries.map(e => `
      <tr data-id="${e.id}">
        <td class="mono">${esc(e.reference || '—')}</td>
        <td>${esc(fmtDate(e.date))}</td>
        <td>${esc(e.memo) || '—'}</td>
        <td>${srcBadge(e.source)}</td>
        <td class="money">${e.total_debit ? fmtMoney(e.total_debit, App.me.company.base_currency) : '—'}</td>
        <td class="money">${e.total_credit ? fmtMoney(e.total_credit, App.me.company.base_currency) : '—'}</td>
        <td style="text-align:end;white-space:nowrap">
          <button class="btn sm ghost" data-act="view">${icon('eye')} ${esc(t('view'))}</button>
          ${e.source === 'manual' ? `<button class="btn sm ghost" data-act="del">${icon('trash')}</button>` : ''}
        </td>
      </tr>`).join('');

    rows.querySelectorAll('tr').forEach(tr => {
      const entry = entries.find(e => e.id === Number(tr.dataset.id));
      tr.querySelector('[data-act=view]').onclick = () => this.showEntry(entry.id);
      const del = tr.querySelector('[data-act=del]');
      if (del) del.onclick = async () => {
        if (!(await confirmDlg(t('je_delete_q')))) return;
        await api('/journal/' + entry.id, { method: 'DELETE' });
        toast(t('toast_deleted'));
        this.render(view);
      };
    });

    view.querySelector('#new-je').onclick = () => this.newEntry(view);
  },

  async showEntry(id) {
    const { entry, lines } = await api('/journal/' + id);
    const bc = App.me.company.base_currency;
    const m = modal({
      title: `${entry.reference || '#' + entry.id} — ${fmtDate(entry.date)}`, wide: true,
      onOpen(body, close) {
        body.innerHTML = `
          <p class="muted" style="margin-top:0">${esc(entry.memo || '')}</p>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('code'))}</th><th>${esc(t('acc_name'))}</th><th class="num">${esc(t('je_debit'))}</th><th class="num">${esc(t('je_credit'))}</th></tr></thead>
            <tbody>
              ${lines.map(l => `<tr><td class="mono">${esc(l.code)}</td><td>${esc(l.name)}</td>
                <td class="money">${l.debit ? fmtMoney(l.debit, bc) : ''}</td><td class="money">${l.credit ? fmtMoney(l.credit, bc) : ''}</td></tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="2">${esc(t('je_total'))}</td>
              <td class="money">${fmtMoney(lines.reduce((s, l) => s + l.debit, 0), bc)}</td>
              <td class="money">${fmtMoney(lines.reduce((s, l) => s + l.credit, 0), bc)}</td></tr></tfoot>
          </table></div>`;
      },
    });
  },

  newEntry(view) {
    const self = this;
    api('/accounts').then(({ accounts: accs }) => {
      const active = accs.filter(a => a.is_active);
      const bc = App.me.company.base_currency;
      const m = modal({
        title: t('je_new'), wide: true,
        onOpen(body, close) {
          body.innerHTML = `
            <div class="form-grid mb">
              <div class="field"><label>${esc(t('je_date'))} <span class="req">*</span></label><input type="date" id="f-date" value="${todayISO()}"></div>
              <div class="field"><label>${esc(t('memo'))}</label><input id="f-memo" placeholder="${esc(t('je_memo'))}"></div>
            </div>
            <div class="table-wrap"><table class="tbl" id="lines-tbl">
              <thead><tr><th>${esc(t('acc_name'))}</th><th class="num">${esc(t('je_debit'))}</th><th class="num">${esc(t('je_credit'))}</th><th></th></tr></thead>
              <tbody></tbody>
              <tfoot><tr><td>${esc(t('je_total'))}</td>
                <td class="money" id="sum-d">0</td><td class="money" id="sum-c">0</td><td></td></tr></tfoot>
            </table></div>
            <div class="summary-box mt" id="balance-box">${esc(t('je_balanced'))} ✓</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:10px;flex-wrap:wrap">
              <button class="btn" id="add-line">${icon('plus')} ${esc(t('je_add_line'))}</button>
              <div style="display:flex;gap:10px">
                <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
                <button class="btn primary" id="f-save">${esc(t('save'))}</button>
              </div>
            </div>`;

          const tbody = body.querySelector('#lines-tbl tbody');
          const recalc = () => {
            let d = 0, c = 0;
            tbody.querySelectorAll('tr').forEach(tr => {
              d += parseFloat(tr.querySelector('.in-d').value) || 0;
              c += parseFloat(tr.querySelector('.in-c').value) || 0;
            });
            body.querySelector('#sum-d').textContent = fmtMoney(d, bc);
            body.querySelector('#sum-c').textContent = fmtMoney(c, bc);
            const ok = Math.abs(d - c) < 0.005;
            body.querySelector('#balance-box').innerHTML = ok
              ? `${esc(t('je_balanced'))} ✓`
              : `<span style="color:var(--red)">⚠ ${esc(t('je_unbalanced'))}</span>`;
            return ok;
          };
          const addLine = (accId = '') => {
            const tr = el(`<tr>
              <td><select class="sel-acc">${active.map(a => `<option value="${a.id}" ${String(a.id) === String(accId) ? 'selected' : ''}>${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select></td>
              <td><input type="number" step="0.01" min="0" class="in-d" style="width:120px;text-align:end"></td>
              <td><input type="number" step="0.01" min="0" class="in-c" style="width:120px;text-align:end"></td>
              <td><button class="btn sm ghost del-line">${icon('trash')}</button></td>
            </tr>`);
            tr.querySelector('.del-line').onclick = () => { tr.remove(); recalc(); };
            tr.querySelector('.in-d').oninput = () => { tr.querySelector('.in-c').value = ''; recalc(); };
            tr.querySelector('.in-c').oninput = () => { tr.querySelector('.in-d').value = ''; recalc(); };
            tbody.appendChild(tr);
            recalc();
          };
          body.querySelector('#add-line').onclick = () => addLine();
          addLine(); addLine();
          body.querySelector('#f-cancel').onclick = close;
          body.querySelector('#f-save').onclick = async () => {
            if (!recalc()) return toast(t('je_unbalanced'), 'err');
            const lines = [...tbody.querySelectorAll('tr')].map(tr => ({
              account_id: Number(tr.querySelector('.sel-acc').value),
              debit: parseFloat(tr.querySelector('.in-d').value) || 0,
              credit: parseFloat(tr.querySelector('.in-c').value) || 0,
            })).filter(l => l.debit || l.credit);
            if (lines.length < 2) return toast(t('err_invalid_entry'), 'err');
            try {
              await api('/journal', { method: 'POST', body: { date: body.querySelector('#f-date').value, memo: body.querySelector('#f-memo').value.trim(), lines } });
              toast(t('je_saved'));
              close();
              self.render(view);
            } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
          };
        },
      });
    });
  },
};
