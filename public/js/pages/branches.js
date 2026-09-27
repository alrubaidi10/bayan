/* Branches Management — Multi-branch with strict data isolation */
const BranchesPage = {
  title: () => t('br_title'),
  async render(view) {
    const self = this;
    const { branches } = await api('/branches');
    const activeBid = getActiveBranchId();
    const isCompanyAdmin = App.me.user.role === 'admin' || App.me.user.is_superadmin;
    const userBranchId = App.me.user.branch_id;

    view.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h3>${esc(t('br_title'))}</h3>
          <span class="badge primary">${branches.length} ${esc(t('br_count'))}</span>
          <div class="spacer"></div>
          ${isCompanyAdmin ? `<button class="btn primary" id="new-branch">${icon('plus')} ${esc(t('br_new'))}</button>` : ''}
        </div>

        <!-- Explanation alert -->
        <div style="padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.4rem">🏢</span>
            <div>
              <b>${esc(t('br_isolation_title'))}</b>
              <div class="muted small">${esc(t('br_isolation_desc'))}</div>
            </div>
          </div>
        </div>

        <div class="table-wrap"><table class="tbl">
          <thead><tr>
            <th>${esc(t('br_name'))}</th>
            <th>${esc(t('br_code'))}</th>
            <th>${esc(t('phone'))}</th>
            <th>${esc(t('address'))}</th>
            <th class="num">${esc(t('br_users_count'))}</th>
            <th>${esc(t('status'))}</th>
            <th style="text-align:end">${esc(t('actions'))}</th>
          </tr></thead>
          <tbody>
            ${branches.map(b => {
              const isActiveBranch = String(b.id) === String(activeBid);
              return `<tr data-id="${b.id}">
                <td>
                  <b>${esc(b.name)}</b>
                  ${isActiveBranch ? `<span class="badge green small" style="margin-inline-start:6px">✓ ${esc(t('br_active_now'))}</span>` : ''}
                </td>
                <td class="mono"><span class="badge gray">${esc(b.code || '—')}</span></td>
                <td class="muted">${esc(b.phone || '—')}</td>
                <td class="muted small">${esc(b.address || '—')}</td>
                <td class="num">${b.user_count || 0}</td>
                <td>${b.is_active ? `<span class="badge green">${esc(t('active'))}</span>` : `<span class="badge gray">${esc(t('inactive'))}</span>`}</td>
                <td style="text-align:end;white-space:nowrap">
                  ${isCompanyAdmin && !isActiveBranch ? `
                    <button class="btn sm" data-act="switch" title="${esc(t('br_switch_to'))}">
                      🔄 ${esc(t('br_switch'))}
                    </button>` : ''}
                  <button class="btn sm ghost" data-act="stats" title="${esc(t('br_stats'))}">${icon('bar')}</button>
                  ${isCompanyAdmin ? `
                    <button class="btn sm ghost" data-act="edit">${icon('edit')}</button>
                    ${branches.length > 1 ? `<button class="btn sm ghost" data-act="del">${icon('trash')}</button>` : ''}
                  ` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>`;

    if (isCompanyAdmin) {
      view.querySelector('#new-branch')?.addEventListener('click', () => self.openForm(null, view));
    }

    view.querySelectorAll('tr[data-id]').forEach(row => {
      const b = branches.find(x => x.id === Number(row.dataset.id));
      if (!b) return;

      // Switch active branch
      row.querySelector('[data-act=switch]')?.addEventListener('click', () => {
        setActiveBranchId(b.id);
        toast(t('br_switched_to', { name: b.name }));
        renderShell();
        self.render(view);
      });

      // View branch stats
      row.querySelector('[data-act=stats]')?.addEventListener('click', () => self.viewStats(b.id));

      // Edit branch
      row.querySelector('[data-act=edit]')?.addEventListener('click', () => self.openForm(b, view));

      // Delete branch
      row.querySelector('[data-act=del]')?.addEventListener('click', async () => {
        if (!(await confirmDlg(t('br_delete_q', { name: b.name })))) return;
        try {
          await api('/branches/' + b.id, { method: 'DELETE' });
          if (String(activeBid) === String(b.id)) setActiveBranchId('');
          toast(t('toast_deleted'));
          self.render(view);
        } catch (e) {
          if (e.message === 'branch_has_data') toast(t('err_branch_has_data'), 'err');
          else if (e.message === 'last_branch') toast(t('err_last_branch'), 'err');
          else toast(t('err_' + e.message) || t('err_generic'), 'err');
        }
      });
    });
  },

  openForm(branch, view) {
    const self = this;
    const isEdit = !!branch;

    modal({
      title: isEdit ? t('br_edit') : t('br_new'),
      onOpen(body, close) {
        body.innerHTML = `
          <div class="form-grid">
            <div class="field"><label>${esc(t('br_name'))} *</label>
              <input id="b-name" value="${esc(branch ? branch.name : '')}" placeholder="${esc(t('br_name_ph'))}"></div>
            <div class="field"><label>${esc(t('br_code'))}</label>
              <input id="b-code" value="${esc(branch ? branch.code : '')}" placeholder="MAIN, BR01..."></div>
            <div class="field"><label>${esc(t('phone'))}</label>
              <input id="b-phone" value="${esc(branch ? branch.phone : '')}" placeholder="+966 5x xxx xxxx"></div>
            <div class="field"><label>${esc(t('address'))}</label>
              <input id="b-address" value="${esc(branch ? branch.address : '')}" placeholder="${esc(t('br_address_ph'))}"></div>
          </div>
          ${isEdit ? `
            <div class="checkbox-row mt">
              <input type="checkbox" id="b-active" ${branch.is_active ? 'checked' : ''}>
              <span>${esc(t('active'))}</span>
            </div>` : ''}
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
            <button class="btn" id="b-cancel">${esc(t('cancel'))}</button>
            <button class="btn primary" id="b-save">${esc(t('save'))}</button>
          </div>`;

        body.querySelector('#b-cancel').onclick = close;
        body.querySelector('#b-save').onclick = async () => {
          const name = body.querySelector('#b-name').value.trim();
          const code = body.querySelector('#b-code').value.trim();
          const phone = body.querySelector('#b-phone').value.trim();
          const address = body.querySelector('#b-address').value.trim();
          if (!name) return toast(t('err_missing_fields'), 'err');

          const payload = { name, code, phone, address };
          if (isEdit) payload.is_active = body.querySelector('#b-active').checked;

          try {
            if (isEdit) await api('/branches/' + branch.id, { method: 'PUT', body: payload });
            else await api('/branches', { method: 'POST', body: payload });
            toast(t('toast_saved'));
            close();
            self.render(view);
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },

  async viewStats(id) {
    const { branch, stats } = await api('/branches/' + id + '/summary');
    const bc = App.me.company.base_currency;

    modal({
      title: `${branch.name} — ${esc(t('br_stats'))}`,
      onOpen(body, close) {
        body.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:16px">
            <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center">
              <div class="muted small">${esc(t('br_stat_rev'))}</div>
              <div style="font-size:1.3rem;font-weight:700;color:var(--primary)">${fmtMoney(stats.revenue, bc)}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center">
              <div class="muted small">${esc(t('br_stat_invoices'))}</div>
              <div style="font-size:1.3rem;font-weight:700">${fmtNum(stats.invoiceCount, 0)}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center">
              <div class="muted small">${esc(t('br_stat_inv_val'))}</div>
              <div style="font-size:1.3rem;font-weight:700">${fmtMoney(stats.invValue, bc)}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center">
              <div class="muted small">${esc(t('br_stat_prods'))}</div>
              <div style="font-size:1.3rem;font-weight:700">${fmtNum(stats.productCount, 0)}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center">
              <div class="muted small">${esc(t('br_stat_custs'))}</div>
              <div style="font-size:1.3rem;font-weight:700">${fmtNum(stats.contactCount, 0)}</div>
            </div>
            <div style="background:var(--bg);padding:12px;border-radius:8px;text-align:center">
              <div class="muted small">${esc(t('br_stat_users'))}</div>
              <div style="font-size:1.3rem;font-weight:700">${fmtNum(stats.userCount, 0)}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn primary" id="stats-close">${esc(t('close'))}</button>
          </div>`;
        body.querySelector('#stats-close').onclick = close;
      },
    });
  },
};
