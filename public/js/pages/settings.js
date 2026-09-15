/* Settings: company profile, tax, currencies, language */
const SettingsPage = {
  title: () => t('set_title'),
  async render(view) {
    const s = await api('/settings');
    const company = s.company;
    const bc = company.base_currency;

    view.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>${esc(t('set_account'))}</h3>
          <span class="badge gray">${esc(App.me.user.email)}</span></div>
        <div class="card-body">
          <p class="muted small mb">${esc(t('adm_login_hint'))}</p>
          <div class="form-grid">
            <div class="field"><label>${esc(t('set_name_label'))}</label>
              <input id="a-name" value="${esc(App.me.user.name)}"></div>
            <div class="field"><label>${esc(t('set_login_email'))}</label>
              <input id="a-email" type="email" value="${esc(App.me.user.email)}"></div>
            <div class="field"><label>${esc(t('set_current_pass'))} <span class="req">*</span></label>
              <input id="a-cur" type="password" autocomplete="current-password" placeholder="••••••••"></div>
            <div class="field"><label>${esc(t('set_new_pass'))}</label>
              <input id="a-new" type="password" autocomplete="new-password" placeholder="••••••••"></div>
            <div class="field"><label>${esc(t('set_confirm_pass'))}</label>
              <input id="a-confirm" type="password" autocomplete="new-password" placeholder="••••••••"></div>
          </div>
          <p class="muted small mt">${esc(t('set_pass_keep'))}</p>
          <div style="display:flex;justify-content:flex-end;margin-top:14px">
            <button class="btn primary" id="save-account">${esc(t('save'))}</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${esc(t('set_company'))}</h3></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field"><label>${esc(t('companyName'))}</label><input id="c-name" value="${esc(company.name)}"></div>
            <div class="field"><label>${esc(t('set_base_cur'))}</label>
              <select id="c-base">${s.currencies.map(c => `<option value="${c.code}" ${c.code === bc ? 'selected' : ''}>${esc(c.code)} — ${esc(c.symbol)}</option>`).join('')}</select></div>
          </div>
          <div class="checkbox-row mt"><input type="checkbox" id="c-tax" ${company.tax_enabled ? 'checked' : ''}><span>${esc(t('set_enable_tax'))}</span></div>
          <div class="field mt" style="max-width:220px"><label>${esc(t('set_tax_rate'))}</label><input type="number" step="0.01" id="c-taxrate" value="${company.tax_rate}"></div>
          <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary" id="save-company">${esc(t('save'))}</button></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${esc(t('backup_title'))}</h3></div>
        <div class="card-body">
          <p class="muted small mb">${esc(t('backup_desc'))}</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn primary" id="backup-export">⬇ ${esc(t('backup_export'))}</button>
            <button class="btn" id="backup-import">⬆ ${esc(t('backup_import'))}</button>
            <input type="file" id="backup-file" accept=".json,application/json" hidden>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${esc(t('set_currencies'))}</h3></div>
        <div class="card-body">
          <p class="muted small mb">${esc(t('rateHint'))}</p>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('currency'))}</th><th>${esc(t('currencyName'))}</th><th>${esc(t('currencySymbol'))}</th><th class="num">${esc(t('ratePerBase'))}</th><th></th></tr></thead>
            <tbody>
              ${s.currencies.map(c => `<tr data-code="${esc(c.code)}">
                <td><b>${esc(c.code)}</b></td><td>${esc(c.name)}</td>
                <td>${esc(c.symbol) || '—'}</td>
                <td><input type="number" step="0.0001" class="rate-in" value="${c.rate}" style="width:130px;text-align:end"></td>
                <td style="text-align:end"><button class="btn sm" data-save-rate>${esc(t('save'))}</button></td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          <p class="muted small mt">${esc(t('rateHint'))}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${esc(t('set_lang'))}</h3></div>
        <div class="card-body">
          <div class="field" style="max-width:280px"><label>${esc(t('set_ui_lang'))}</label>
            <select id="lang-select">
              <option value="en" ${getLang() === 'en' ? 'selected' : ''}>English</option>
              <option value="ar" ${getLang() === 'ar' ? 'selected' : ''}>العربية</option>
            </select></div>
        </div>
      </div>`;

    /* ---- self-service: change name / email / password ---- */
    view.querySelector('#save-account').onclick = async () => {
      const newPass = view.querySelector('#a-new').value;
      const confirmPass = view.querySelector('#a-confirm').value;
      if (newPass && newPass !== confirmPass) return toast(t('err_pass_mismatch'), 'err');
      const payload = {
        name: view.querySelector('#a-name').value.trim(),
        email: view.querySelector('#a-email').value.trim(),
        current_password: view.querySelector('#a-cur').value,
        new_password: newPass || undefined,
      };
      try {
        const r = await api('/auth/account', { method: 'PUT', body: payload });
        App.me.user.name = r.user.name;
        App.me.user.email = r.user.email;
        view.querySelector('#a-cur').value = '';
        view.querySelector('#a-new').value = '';
        view.querySelector('#a-confirm').value = '';
        toast(t('toast_account_saved'));
        renderShell();
        route();
      } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
    };

    view.querySelector('#lang-select').onchange = e => {
      setLang(e.target.value);
      location.hash = '#/settings';
      location.reload();
    };

    /* ---- backup: export ---- */
    view.querySelector('#backup-export').onclick = async () => {
      const btn = view.querySelector('#backup-export');
      btn.disabled = true;
      try {
        const res = await fetch('/api/backup/export', {
          headers: { Authorization: 'Bearer ' + getToken() },
        });
        if (!res.ok) {
          let data = {};
          try { data = await res.json(); } catch (e) {}
          throw new Error(data.error || 'generic_error');
        }
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename="?([^";]+)"?/);
        const fname = m ? m[1] : 'bayan-backup-' + todayISO() + '.json';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast(t('backup_exported'));
      } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
      btn.disabled = false;
    };

    /* ---- backup: import ---- */
    view.querySelector('#backup-import').onclick = () => view.querySelector('#backup-file').click();
    view.querySelector('#backup-file').onchange = async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!(await confirmDlg(t('backup_import_confirm')))) return;
      const btn = view.querySelector('#backup-import');
      btn.disabled = true;
      try {
        const text = await file.text();
        let payload;
        try { payload = JSON.parse(text); } catch (err) { throw new Error('invalid_backup'); }
        const r = await api('/backup/import', { method: 'POST', body: payload });
        const c = r.counts || {};
        toast(t('backup_import_done'));
        toast(t('backup_restored_counts', {
          accounts: c.accounts ?? 0, contacts: c.contacts ?? 0, products: c.products ?? 0,
          invoices: c.invoices ?? 0, entries: c.entries ?? 0, quotes: c.quotes ?? 0,
        }));
        setTimeout(() => location.reload(), 3200);
      } catch (err) { toast(t('err_' + err.message) || t('err_generic'), 'err'); }
      btn.disabled = false;
    };

    view.querySelector('#save-company').onclick = async () => {
      try {
        const r = await api('/settings', {
          method: 'PUT',
          body: {
            name: view.querySelector('#c-name').value.trim() || company.name,
            base_currency: view.querySelector('#c-base').value,
            tax_enabled: view.querySelector('#c-tax').checked,
            tax_rate: parseFloat(view.querySelector('#c-taxrate').value) || 0,
          },
        });
        App.me.company = r.company;
        await loadMeta();
        toast(t('set_saved'));
        renderShell();
        route();
      } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
    };

    view.querySelectorAll('[data-save-rate]').forEach(btn => {
      btn.onclick = async () => {
        const tr = btn.closest('tr');
        try {
          await api('/currencies/' + tr.dataset.code, {
            method: 'PUT',
            body: { rate: parseFloat(tr.querySelector('.rate-in').value) || 1 },
          });
          await loadMeta();
          toast(t('toast_updated'));
          this.render(view);
        } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
      };
    });
  },
};
