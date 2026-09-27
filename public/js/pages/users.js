/* Users & Roles — company user management (admin only) */
const UsersPage = {
  title: () => t('usr_title'),
  async render(view) {
    const self = this;

    // Role definitions with colors and Arabic labels
    const ROLE_META = {
      admin:      { label: t('role_admin'),      color: 'red',     icon: '👑' },
      manager:    { label: t('role_manager'),    color: 'primary', icon: '🏢' },
      accountant: { label: t('role_accountant'), color: 'amber',   icon: '📊' },
      staff:      { label: t('role_staff'),      color: 'green',   icon: '👤' },
      cashier:    { label: t('role_cashier'),    color: 'gray',    icon: '🧾' },
    };

    const { users } = await api('/users');
    const currentUserId = App.me.user.id;

    view.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h3>${esc(t('usr_title'))}</h3>
          <span class="badge primary">${users.length} ${esc(t('usr_count'))}</span>
          <div class="spacer"></div>
          <button class="btn primary" id="new-user">${icon('plus')} ${esc(t('usr_new'))}</button>
        </div>

        <!-- Role legend -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border)">
          ${Object.entries(ROLE_META).map(([k, v]) => `
            <div style="display:flex;align-items:center;gap:6px">
              <span class="badge ${v.color}">${v.icon} ${esc(v.label)}</span>
              <span class="muted small">—</span>
              <span class="muted small">${esc(t('role_desc_' + k))}</span>
            </div>`).join('')}
        </div>

        <div class="table-wrap"><table class="tbl">
          <thead><tr>
            <th>${esc(t('fullName'))}</th>
            <th>${esc(t('email'))}</th>
            <th>${esc(t('usr_role'))}</th>
            <th>${esc(t('br_title'))}</th>
            <th>${esc(t('usr_permissions'))}</th>
            <th>${esc(t('date'))}</th>
            <th style="text-align:end">${esc(t('actions'))}</th>
          </tr></thead>
          <tbody>
            ${users.map(u => {
              const meta = ROLE_META[u.role] || ROLE_META.staff;
              const isMe = u.id === currentUserId;
              return `<tr data-id="${u.id}">
                <td>
                  <b>${esc(u.name)}</b>
                  ${isMe ? `<span class="badge green small" style="margin-inline-start:6px">${esc(t('usr_you'))}</span>` : ''}
                </td>
                <td class="mono muted">${esc(u.email)}</td>
                <td><span class="badge ${meta.color}">${meta.icon} ${esc(meta.label)}</span></td>
                <td>
                  ${u.branch_name ? `<span class="badge gray">🏢 ${esc(u.branch_name)}</span>` : `<span class="badge primary small">${esc(t('br_all_branches'))}</span>`}
                </td>
                <td class="muted small">${esc(t('role_pages_' + u.role))}</td>
                <td class="muted small">${esc(fmtDate(u.created_at))}</td>
                <td style="text-align:end;white-space:nowrap">
                  <button class="btn sm ghost" data-act="edit">${icon('edit')}</button>
                  ${!isMe ? `<button class="btn sm ghost" data-act="del">${icon('trash')}</button>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>

      <!-- Permissions matrix reference card -->
      <div class="card" style="margin-top:14px">
        <div class="card-head"><h3>${esc(t('usr_permissions_matrix'))}</h3></div>
        <div style="overflow-x:auto;padding:0 16px 16px">
          <table class="tbl" style="min-width:600px">
            <thead><tr>
              <th>${esc(t('usr_section'))}</th>
              <th style="text-align:center">👑 ${esc(t('role_admin'))}</th>
              <th style="text-align:center">🏢 ${esc(t('role_manager'))}</th>
              <th style="text-align:center">📊 ${esc(t('role_accountant'))}</th>
              <th style="text-align:center">👤 ${esc(t('role_staff'))}</th>
              <th style="text-align:center">🧾 ${esc(t('role_cashier'))}</th>
            </tr></thead>
            <tbody>
              ${[
                ['nav_dashboard',    1,1,1,1,1],
                ['nav_accounting',   1,1,1,0,0],
                ['nav_invoices',     1,1,1,1,1],
                ['nav_bills',        1,1,1,1,0],
                ['nav_customers',    1,1,1,1,1],
                ['nav_suppliers',    1,1,1,1,0],
                ['nav_expenses',     1,1,1,1,0],
                ['nav_quotes',       1,1,1,1,0],
                ['nav_debts',        1,1,1,0,0],
                ['nav_inventory',    1,1,1,1,1],
                ['nav_inv_print',    1,1,1,0,0],
                ['nav_transfers',    1,1,0,1,0],
                ['nav_reports',      1,1,1,0,0],
                ['set_title',        1,0,0,0,0],
                ['usr_title',        1,0,0,0,0],
              ].map(([k, ...perms]) => `<tr>
                <td>${esc(t(k))}</td>
                ${perms.map(p => `<td style="text-align:center;font-size:1.1rem">${p ? '✅' : '❌'}</td>`).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    view.querySelector('#new-user').onclick = () => self.openForm(null, users, view);
    view.querySelectorAll('tr[data-id]').forEach(row => {
      const u = users.find(x => x.id === Number(row.dataset.id));
      if (!u) return;
      row.querySelector('[data-act=edit]')?.addEventListener('click', () => self.openForm(u, users, view));
      row.querySelector('[data-act=del]')?.addEventListener('click', async () => {
        if (!(await confirmDlg(t('usr_delete_q', { name: u.name })))) return;
        try {
          await api('/users/' + u.id, { method: 'DELETE' });
          toast(t('toast_deleted'));
          self.render(view);
        } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
      });
    });
  },

  openForm(user, allUsers, view) {
    const self = this;
    const isEdit = !!user;
    const ROLES = ['admin', 'manager', 'accountant', 'staff', 'cashier'];

    const branches = App.branches || [];

    modal({
      title: isEdit ? t('usr_edit') : t('usr_new'),
      onOpen(body, close) {
        body.innerHTML = `
          <div class="form-grid">
            <div class="field"><label>${esc(t('fullName'))} *</label>
              <input id="u-name" value="${esc(user ? user.name : '')}"></div>
            <div class="field"><label>${esc(t('email'))} *</label>
              <input id="u-email" type="email" value="${esc(user ? user.email : '')}"></div>
            <div class="field"><label>${esc(t('usr_role'))} *</label>
              <select id="u-role">
                ${ROLES.map(r => `<option value="${r}" ${user && user.role === r ? 'selected' : ''}>${
                  { admin: '👑 ' + t('role_admin'), manager: '🏢 ' + t('role_manager'),
                    accountant: '📊 ' + t('role_accountant'), staff: '👤 ' + t('role_staff'),
                    cashier: '🧾 ' + t('role_cashier') }[r]
                }</option>`).join('')}
              </select></div>
            <div class="field"><label>${esc(t('br_title'))}</label>
              <select id="u-branch">
                <option value="">${esc(t('br_all_branches_admin'))}</option>
                ${branches.map(b => `<option value="${b.id}" ${user && String(user.branch_id) === String(b.id) ? 'selected' : ''}>🏢 ${esc(b.name)}</option>`).join('')}
              </select></div>
            <div class="field" style="grid-column:1/-1"><label>${esc(t(isEdit ? 'adm_new_password' : 'adm_user_password'))} ${isEdit ? `<span class="muted small">(${esc(t('set_pass_keep'))})</span>` : '*'}</label>
              <input id="u-pass" type="password" autocomplete="new-password" placeholder="••••••" ${!isEdit ? 'required' : ''}></div>
          </div>
          <!-- Role description -->
          <div id="role-desc" style="margin-top:12px;padding:10px 14px;background:var(--bg);border-radius:8px;font-size:.88rem">
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
            <button class="btn" id="u-cancel">${esc(t('cancel'))}</button>
            <button class="btn primary" id="u-save">${esc(t('save'))}</button>
          </div>`;

        const roleDescriptions = {
          admin:      t('role_desc_long_admin'),
          manager:    t('role_desc_long_manager'),
          accountant: t('role_desc_long_accountant'),
          staff:      t('role_desc_long_staff'),
          cashier:    t('role_desc_long_cashier'),
        };

        const updateDesc = () => {
          const role = body.querySelector('#u-role').value;
          body.querySelector('#role-desc').innerHTML = `<b>${t('role_' + role)}</b>: ${esc(roleDescriptions[role] || '')}`;
        };
        updateDesc();
        body.querySelector('#u-role').onchange = updateDesc;
        body.querySelector('#u-cancel').onclick = close;

        body.querySelector('#u-save').onclick = async () => {
          const name = body.querySelector('#u-name').value.trim();
          const email = body.querySelector('#u-email').value.trim();
          const role = body.querySelector('#u-role').value;
          const branch_id = body.querySelector('#u-branch').value ? Number(body.querySelector('#u-branch').value) : null;
          const password = body.querySelector('#u-pass').value;
          if (!name || !email || !role) return toast(t('err_missing_fields'), 'err');
          if (!isEdit && !password) return toast(t('err_missing_fields'), 'err');
          try {
            const payload = { name, email, role, branch_id };
            if (password) payload.password = password;
            if (isEdit) await api('/users/' + user.id, { method: 'PUT', body: payload });
            else await api('/users', { method: 'POST', body: payload });
            toast(t('toast_saved'));
            close();
            self.render(view);
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },
};
