/* Platform Admin Panel — manage customer companies, subscriptions, users, messages */
const AdminPage = {
  title: () => t('adm_title'),

  async render(view) {
    const self = this;
    const [stats, { companies }, { notifications }] = await Promise.all([
      api('/admin/stats'), api('/admin/companies'), api('/admin/notifications'),
    ]);
    const statusBadge = (st) => {
      const map = { active: 'green', trial: 'amber', suspended: 'red', expired: 'red' };
      return `<span class="badge ${map[st] || 'gray'}">${esc(t('sub_' + st) || st)}</span>`;
    };

    view.innerHTML = `
      <div class="kpi-grid mb" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
        <div class="kpi primary"><div class="k-label">${esc(t('adm_stats_total'))}</div><div class="k-value">${stats.total}</div></div>
        <div class="kpi green"><div class="k-label">${esc(t('adm_stats_active'))}</div><div class="k-value">${stats.active}</div></div>
        <div class="kpi amber"><div class="k-label">${esc(t('adm_stats_trial'))}</div><div class="k-value">${stats.trial}</div></div>
        <div class="kpi amber"><div class="k-label">${esc(t('adm_stats_expiring'))}</div><div class="k-value">${stats.expiring30}</div></div>
        <div class="kpi red"><div class="k-label">${esc(t('adm_stats_locked'))}</div><div class="k-value">${stats.locked}</div></div>
        <div class="kpi primary"><div class="k-label">${esc(t('adm_stats_users'))}</div><div class="k-value">${stats.users}</div></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${esc(t('adm_companies'))}</h3>
          <div class="spacer"></div>
          <button class="btn ghost primary" id="adm-msg-all">📢 إرسال جماعي لكل العملاء</button>
          <button class="btn primary" id="adm-add-customer">${icon('plus')} ${esc(t('adm_add_customer'))}</button>
          <div class="field" style="min-width:210px"><input id="adm-q" placeholder="${esc(t('adm_search'))}"></div>
          <div class="field" style="min-width:150px">
            <select id="adm-status">
              <option value="all">${esc(t('adm_status_all'))}</option>
              <option value="active">${esc(t('sub_active'))}</option>
              <option value="trial">${esc(t('sub_trial'))}</option>
              <option value="suspended">${esc(t('sub_suspended'))}</option>
              <option value="expired">${esc(t('sub_expired'))}</option>
            </select>
          </div>
        </div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('adm_company'))}</th><th>${esc(t('adm_owner'))}</th><th class="num">${esc(t('adm_users'))}</th>
            <th>${esc(t('sub_plan'))}</th><th>${esc(t('sub_expiry'))}</th><th class="num">${esc(t('adm_days_left'))}</th>
            <th>${esc(t('sub_status'))}</th><th style="text-align:end">${esc(t('actions'))}</th></tr></thead>
          <tbody id="rows"></tbody>
        </table></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${esc(t('adm_outbox'))}</h3></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>${esc(t('adm_to'))}</th><th>${esc(t('adm_subject'))}</th><th>${esc(t('adm_message'))}</th><th>${esc(t('date'))}</th><th>${esc(t('name'))}</th><th style="text-align:end">${esc(t('actions'))}</th></tr></thead>
          <tbody>
            ${notifications.length ? notifications.map(n => `<tr data-nid="${n.id}">
              <td>${esc(n.company_name)}</td><td><b>${esc(n.subject)}</b></td>
              <td class="small muted">${esc(n.message)}</td><td>${esc(fmtDate(n.created_at))}</td>
              <td class="small">${esc(n.sender_name || '')}</td>
              <td style="text-align:end"><button class="btn sm ghost red" data-act="del-notif">${esc(t('delete'))}</button></td></tr>`).join('')
            : `<tr><td colspan="6">${emptyState(t('noData'))}</td></tr>`}
          </tbody>
        </table></div>
      </div>`;

    const tbody = view.querySelector('#rows');
    const draw = (list) => {
      tbody.innerHTML = list.map(c => `
        <tr data-id="${c.id}">
          <td><b>${esc(c.name)}</b></td>
          <td>${esc(c.owner_email || '—')}${c.status === 'trial' ? ` <span class="badge amber">${esc(t('adm_trial_badge'))}</span>` : ''}</td>
          <td class="num">${c.user_count}</td>
          <td><span class="badge gray">${esc(t('sub_' + (c.plan || 'active')) || c.plan)}</span></td>
          <td class="mono small">${esc(c.subscription_end || '—')}</td>
          <td class="num">
            ${c.days_left === null ? `<span class="muted small">${esc(t('adm_no_expiry'))}</span>`
              : c.days_left < 0 ? `<span class="badge red">${esc(t('sub_expired'))}</span>`
              : c.days_left <= 7 ? `<span class="badge red">${c.days_left} ${esc(t('sub_day_left')).replace('1 ', '')}</span>`
              : c.days_left <= 30 ? `<span class="badge amber">${c.days_left} ${esc(t('sub_days_left', { n: '' })).trim()}</span>`
              : `<span class="badge green">${c.days_left} ${esc(t('sub_days_left', { n: '' })).trim()}</span>`}
          </td>
          <td>${statusBadge(c.status)}</td>
          <td style="text-align:end;white-space:nowrap">
            <button class="btn sm ghost" data-act="users" title="${esc(t('adm_users_title', { name: c.name }))}">${icon('users')}</button>
            <button class="btn sm ghost" data-act="sub">${esc(t('adm_set_sub'))}</button>
            <button class="btn sm ghost" data-act="user">${esc(t('adm_new_user'))}</button>
            <button class="btn sm ghost" data-act="msg">${esc(t('adm_send_msg'))}</button>
            ${c.status === 'suspended' || c.status === 'expired'
              ? `<button class="btn sm ghost green" data-act="activate">${esc(t('adm_activate'))}</button>`
              : `<button class="btn sm ghost red" data-act="suspend">${esc(t('adm_suspend'))}</button>`}
          </td>
        </tr>`).join('') || `<tr><td colspan="8">${emptyState(t('noData'))}</td></tr>`;
    };
    draw(companies);

    const reload = () => self.render(view);
    tbody.querySelectorAll('tr').forEach(tr => {
      const c = companies.find(x => x.id === Number(tr.dataset.id));
      tr.querySelectorAll('[data-act]').forEach(b => {
        b.onclick = () => {
          const a = b.dataset.act;
          if (a === 'sub') self.subModal(c, reload);
          else if (a === 'user') self.userModal(c, reload);
          else if (a === 'users') self.usersModal(c, reload);
          else if (a === 'msg') self.msgModal(c, reload);
          else if (a === 'suspend') self.toggleStatus(c, 'suspended', reload);
          else if (a === 'activate') self.toggleStatus(c, 'active', reload);
        };
      });
    });

    /* create a customer account (company + user) from scratch */
    view.querySelector('#adm-add-customer').onclick = () => self.newCustomerModal(reload);
    view.querySelector('#adm-msg-all').onclick = () => self.broadcastModal(reload);

    /* outbox message deletion */
    view.querySelectorAll('[data-act=del-notif]').forEach(btn => {
      btn.onclick = async () => {
        const nid = btn.closest('tr').dataset.nid;
        if (!(await confirmDlg('هل تريد حذف هذه الرسالة من السجل؟'))) return;
        try {
          await api('/admin/notifications/' + nid, { method: 'DELETE' });
          toast(t('toast_deleted'));
          reload();
        } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
      };
    });

    /* search + filter */
    const applyFilter = debounce(async () => {
      const q = view.querySelector('#adm-q').value.trim();
      const st = view.querySelector('#adm-status').value;
      const d = await api('/admin/companies?q=' + encodeURIComponent(q) + '&status=' + st);
      draw(d.companies);
    }, 300);
    view.querySelector('#adm-q').oninput = applyFilter;
    view.querySelector('#adm-status').onchange = applyFilter;
  },

  broadcastModal(reload) {
    const m = modal({
      title: '📢 إرسال رسالة جماعية لجميع العملاء',
      onOpen(body, close) {
        body.innerHTML = `
          <p class="muted small" style="margin-top:0">ستصل هذه الرسالة إلى لوحة تحكم جميع شركات العملاء المسجلة في النظام.</p>
          <div class="field" style="margin-bottom:12px"><label>${esc(t('adm_subject'))} *</label>
            <input id="f-subject" placeholder="مثال: تحديث جديد / إشعار صيانة / عرض خاص"></div>
          <div class="field"><label>${esc(t('adm_message'))} *</label><textarea id="f-message" rows="5" placeholder="اكتب نص الرسالة هنا..."></textarea></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
            <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
            <button class="btn primary" id="f-save">${icon('send')} إرسال للكل</button>
          </div>`;
        body.querySelector('#f-cancel').onclick = close;
        body.querySelector('#f-save').onclick = async () => {
          const subject = body.querySelector('#f-subject').value.trim();
          const message = body.querySelector('#f-message').value.trim();
          if (!subject || !message) return toast(t('err_missing_fields'), 'err');
          try {
            const res = await api('/admin/notify-all', { method: 'POST', body: { subject, message } });
            toast(`تم إرسال الرسالة لـ ${res.count} عميل بنجاح ✅`);
            close();
            reload();
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },

  newCustomerModal(reload) {
    const m = modal({
      title: t('adm_new_customer_title'), wide: true,
      onOpen(body, close) {
        body.innerHTML = `
          <p class="muted small" style="margin-top:0">${esc(t('adm_login_hint'))}</p>
          <div class="form-grid">
            <div class="field"><label>${esc(t('adm_company_name'))} *</label><input id="c-name"></div>
            <div class="field"><label>${esc(t('set_base_cur'))}</label>
              <select id="c-cur"><option value="USD">USD — $</option><option value="YER">YER — ﷼</option><option value="SAR">SAR — ﷼</option><option value="EUR">EUR — €</option></select></div>
            <div class="field"><label>${esc(t('adm_user_name'))} *</label><input id="c-username"></div>
            <div class="field"><label>${esc(t('adm_user_email'))} *</label><input id="c-useremail" type="email"></div>
            <div class="field"><label>${esc(t('adm_user_password'))} *</label><input id="c-pass" value="mizan${Math.floor(1000 + Math.random() * 9000)}"></div>
            <div class="field"><label>${esc(t('adm_add_days'))}</label><input type="number" id="c-days" value="365" min="1"></div>
          </div>
          <div class="summary-box mt" id="c-result" hidden></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
            <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
            <button class="btn primary" id="f-save">${icon('plus')} ${esc(t('adm_add_customer'))}</button>
          </div>`;
        body.querySelector('#f-cancel').onclick = close;
        body.querySelector('#f-save').onclick = async () => {
          const payload = {
            name: body.querySelector('#c-name').value.trim(),
            base_currency: body.querySelector('#c-cur').value,
            user_name: body.querySelector('#c-username').value.trim(),
            user_email: body.querySelector('#c-useremail').value.trim(),
            password: body.querySelector('#c-pass').value,
            add_days: parseInt(body.querySelector('#c-days').value) || undefined,
          };
          if (!payload.name || !payload.user_name || !payload.user_email || !payload.password) {
            return toast(t('err_missing_fields'), 'err');
          }
          try {
            const r = await api('/admin/companies', { method: 'POST', body: payload });
            const box = body.querySelector('#c-result');
            box.hidden = false;
            box.innerHTML = `✅ ${esc(t('adm_customer_created', { email: r.user.email, password: payload.password }))}`;
            toast(t('toast_saved'));
            reload();
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },

  usersModal(c, reload) {
    const m = modal({
      title: t('adm_users_title', { name: c.name }), wide: true,
      onOpen(body, close) {
        body.innerHTML = `<div style="text-align:center;color:var(--muted);padding:20px">${esc(t('loading'))}</div>`;
        api('/admin/companies/' + c.id + '/users').then(d => {
          body.innerHTML = `<div class="table-wrap"><table class="tbl">
            <thead><tr><th>${esc(t('name'))}</th><th>${esc(t('email'))}</th><th>${esc(t('adm_user_role'))}</th><th style="text-align:end">${esc(t('actions'))}</th></tr></thead>
            <tbody>
              ${d.users.map(u => `<tr data-uid="${u.id}">
                <td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td>
                <td><span class="badge gray">${esc(u.is_superadmin ? t('adm_role_admin') + ' ⭐' : t('adm_role_' + (u.role || 'staff')))}</span></td>
                <td style="text-align:end">
                  <button class="btn sm ghost" data-act="reset">${esc(t('adm_reset_pass'))}</button>
                </td></tr>`).join('')}
            </tbody>
          </table></div>
          <div id="reset-box" class="mt" hidden style="border:1px solid var(--border);border-radius:10px;padding:14px">
            <div class="field"><label id="reset-lbl">${esc(t('adm_reset_title', { name: '' }))}</label>
              <input type="text" id="reset-pass" placeholder="${esc(t('adm_new_password'))}"></div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
              <button class="btn sm" id="reset-cancel">${esc(t('cancel'))}</button>
              <button class="btn sm primary" id="reset-save">${esc(t('save'))}</button>
            </div>
          </div>`;
          body.querySelectorAll('[data-act=reset]').forEach(btn => {
            btn.onclick = () => {
              const u = d.users.find(x => x.id === Number(btn.closest('tr').dataset.uid));
              const box = body.querySelector('#reset-box');
              box.hidden = false;
              body.querySelector('#reset-lbl').textContent = t('adm_reset_title', { name: u.name + ' (' + u.email + ')' });
              body.querySelector('#reset-pass').value = 'mizan' + Math.floor(1000 + Math.random() * 9000);
              body.querySelector('#reset-cancel').onclick = () => { box.hidden = true; };
              body.querySelector('#reset-save').onclick = async () => {
                try {
                  await api('/admin/users/' + u.id + '/password', { method: 'PUT', body: { password: body.querySelector('#reset-pass').value } });
                  toast(t('adm_pass_reset_ok'));
                  box.hidden = true;
                } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
              };
            };
          });
        }).catch(() => body.innerHTML = emptyState(t('err_generic')));
      },
    });
  },

  async toggleStatus(c, status, reload) {
    if (!(await confirmDlg(status === 'suspended' ? t('adm_suspend_confirm') : t('adm_activate_confirm')))) return;
    await api('/admin/companies/' + c.id + '/status', { method: 'PUT', body: { status } });
    toast(t('toast_updated'));
    reload();
  },

  subModal(c, reload) {
    const m = modal({
      title: t('adm_set_title', { name: c.name }),
      onOpen(body, close) {
        body.innerHTML = `
          <div class="form-grid">
            <div class="field"><label>${esc(t('adm_plan'))}</label>
              <select id="f-plan">
                ${['trial', 'basic', 'premium', 'enterprise'].map(p => `<option value="${p}" ${c.plan === p ? 'selected' : ''}>${esc(t('sub_' + p))}</option>`).join('')}
              </select></div>
            <div class="field"><label>${esc(t('sub_status'))}</label>
              <select id="f-status">
                ${['active', 'trial', 'suspended', 'expired'].map(s => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${esc(t('sub_' + s))}</option>`).join('')}
              </select></div>
            <div class="field"><label>${esc(t('adm_add_days'))}</label><input type="number" id="f-days" min="1" placeholder="30"></div>
            <div class="field"><label>${esc(t('adm_add_months'))}</label><input type="number" id="f-months" min="1" placeholder="6"></div>
            <div class="field"><label>${esc(t('adm_add_years'))}</label><input type="number" id="f-years" min="1" placeholder="1"></div>
            <div class="field"><label>${esc(t('adm_or'))} — ${esc(t('adm_expiry_date'))}</label>
              <input type="date" id="f-end" value="${esc(c.subscription_end || '')}"></div>
          </div>
          <p class="muted small mt">${esc(t('adm_dur_hint'))}</p>
          <p class="muted small">${esc(t('sub_expiry'))}: <b>${esc(c.subscription_end || '—')}</b> · ${esc(t('adm_days_left'))}: <b>${c.days_left ?? '—'}</b></p>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
            <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
            <button class="btn primary" id="f-save">${esc(t('adm_save_sub'))}</button>
          </div>`;
        body.querySelector('#f-cancel').onclick = close;
        body.querySelector('#f-save').onclick = async () => {
          try {
            await api('/admin/companies/' + c.id + '/subscription', {
              method: 'PUT',
              body: {
                plan: body.querySelector('#f-plan').value,
                status: body.querySelector('#f-status').value,
                add_days: parseInt(body.querySelector('#f-days').value) || undefined,
                add_months: parseInt(body.querySelector('#f-months').value) || undefined,
                add_years: parseInt(body.querySelector('#f-years').value) || undefined,
                subscription_end: body.querySelector('#f-end').value || undefined,
              },
            });
            toast(t('toast_saved'));
            close();
            reload();
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },

  userModal(c, reload) {
    const m = modal({
      title: t('adm_user_title', { name: c.name }),
      onOpen(body, close) {
        body.innerHTML = `
          <div class="form-grid">
            <div class="field"><label>${esc(t('adm_user_name'))} *</label><input id="f-name"></div>
            <div class="field"><label>${esc(t('adm_user_email'))} *</label><input id="f-email" type="email"></div>
            <div class="field"><label>${esc(t('adm_user_password'))} *</label><input id="f-pass" type="text" value="${'user' + Math.floor(1000 + Math.random() * 9000)}"></div>
            <div class="field"><label>${esc(t('adm_user_role'))}</label>
              <select id="f-role"><option value="admin">${esc(t('adm_role_admin'))}</option><option value="staff">${esc(t('adm_role_staff'))}</option></select></div>
          </div>
          <div class="summary-box mt" id="u-result" hidden></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
            <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
            <button class="btn primary" id="f-save">${esc(t('save'))}</button>
          </div>`;
        body.querySelector('#f-cancel').onclick = close;
        body.querySelector('#f-save').onclick = async () => {
          const payload = {
            name: body.querySelector('#f-name').value.trim(),
            email: body.querySelector('#f-email').value.trim(),
            password: body.querySelector('#f-pass').value,
            role: body.querySelector('#f-role').value,
          };
          if (!payload.name || !payload.email || !payload.password) return toast(t('err_missing_fields'), 'err');
          try {
            const r = await api('/admin/companies/' + c.id + '/users', { method: 'POST', body: payload });
            const box = body.querySelector('#u-result');
            box.hidden = false;
            box.innerHTML = `✅ ${esc(t('adm_user_created', { email: r.user.email, password: payload.password }))}`;
            toast(t('toast_saved'));
            reload();
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },

  msgModal(c, reload) {
    const m = modal({
      title: t('adm_msg_title', { name: c.name }),
      onOpen(body, close) {
        body.innerHTML = `
          <div class="field" style="margin-bottom:12px"><label>${esc(t('adm_subject'))} *</label>
            <input id="f-subject" placeholder="${esc(t('sub_expiry'))} / ${esc(t('sub_days_left', { n: c.days_left ?? '?' }))}"></div>
          <div class="field"><label>${esc(t('adm_message'))} *</label><textarea id="f-message" rows="4"></textarea></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
            <button class="btn" id="f-cancel">${esc(t('cancel'))}</button>
            <button class="btn primary" id="f-save">${icon('send')} ${esc(t('adm_send_msg'))}</button>
          </div>`;
        body.querySelector('#f-cancel').onclick = close;
        body.querySelector('#f-save').onclick = async () => {
          const subject = body.querySelector('#f-subject').value.trim();
          const message = body.querySelector('#f-message').value.trim();
          if (!subject || !message) return toast(t('err_missing_fields'), 'err');
          try {
            await api('/admin/companies/' + c.id + '/notify', { method: 'POST', body: { subject, message } });
            toast(t('adm_msg_sent'));
            close();
            reload();
          } catch (e) { toast(t('err_' + e.message) || t('err_generic'), 'err'); }
        };
      },
    });
  },
};
