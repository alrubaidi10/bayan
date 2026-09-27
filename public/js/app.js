/* Mizan ERP — app shell, router, state */
const App = {
  me: null,      // {user, company}
  currencies: {},// code -> {code, symbol, name, rate}
  route: '',
  notifications: [],
};

async function boot() {
  setLang(localStorage.getItem('mizan_lang') || 'en');
  if (!getToken()) return showLogin();
  try {
    const me = await api('/auth/me');
    App.me = me;
    await loadMeta();
    renderShell();
    route();
  } catch (e) {
    showLogin();
  }
}

async function loadMeta() {
  try {
    const s = await api('/settings');
    App.currencies = {};
    for (const c of s.currencies) App.currencies[c.code] = c;
    window._currencies = App.currencies;
  } catch (e) { /* ok */ }
}

function showLogin() {
  document.getElementById('app').innerHTML = '';
  const wrap = el(`<div class="login-wrap"><div id="login-card"></div></div>`);
  document.getElementById('app').appendChild(wrap);
  LoginPage.render(wrap.querySelector('#login-card'));
}

/* Full-screen "account blocked" screen (suspended / expired subscription) */
function showBlocked(code) {
  const title = code === 'account_suspended' ? t('acct_suspended_title') : t('acct_expired_title');
  const msg = code === 'account_suspended' ? t('acct_suspended_msg') : t('acct_expired_msg');
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card" style="text-align:center">
        <div class="logo-big" style="background:linear-gradient(135deg,#dc2626,#f59e0b)">🚫</div>
        <h1>${esc(title)}</h1>
        <p class="muted" style="margin:10px 0 4px">${esc(msg)}</p>
        <p class="muted small">${esc(t('acct_blocked_note'))}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:18px">
          <button class="btn primary" id="blocked-exit">${esc(t('signOut'))}</button>
        </div>
      </div>
    </div>`;
  document.getElementById('blocked-exit').onclick = () => { setToken(null); showLogin(); };
}
window.showBlocked = showBlocked;

function renderShell() {
  const isSuper = !!App.me.user.is_superadmin;
  const groups = [
    { label: '', items: [
      ['dashboard', 'nav_dashboard', 'dashboard'],
      ['debts', 'nav_debts', 'wallet'],
    ] },
    { label: 'nav_accounting', items: [
      ['accounts', 'nav_accounts', 'book'],
      ['journal', 'nav_journal', 'pen'],
      ['ledger', 'nav_ledger', 'list'],
      ['trial', 'nav_trial', 'scale'],
      ['pnl', 'nav_pnl', 'bar'],
      ['balance-sheet', 'nav_balance', 'briefcase'],
    ]},
    { label: 'nav_sales', items: [
      ['invoices', 'nav_invoices', 'file'],
      ['customers', 'nav_customers', 'users'],
      ['quotes', 'nav_quotes', 'file'],
    ]},
    { label: 'nav_purchases', items: [
      ['bills', 'nav_bills', 'truck'],
      ['suppliers', 'nav_suppliers', 'building'],
      ['expenses', 'nav_expenses', 'receipt'],
    ]},
    { label: 'nav_inventory', items: [
      ['inventory', 'nav_products', 'box'],
      ['inventory-print', 'nav_inv_print', 'file'],
      ['transfers', 'nav_transfers', 'layers'],
    ] },
    { label: 'nav_reports', items: [['reports', 'nav_reports', 'bar']] },
    { label: '', items: [
      ['settings', 'nav_settings', 'gear'],
      ...(isSuper ? [['admin', 'nav_admin', 'gear']] : []),
    ]},
  ];
  const initials = (App.me.user.name || 'U').trim().charAt(0).toUpperCase();
  const sub = App.me.company;
  const days = sub.days_left;
  let subChip = '';
  if (sub.status === 'suspended' || sub.status === 'expired') {
    subChip = `<span class="badge red">${esc(t('sub_' + sub.status))}</span>`;
  } else if (sub.status === 'trial') {
    subChip = `<span class="badge amber" title="${esc(t('sub_expiry'))}: ${esc(sub.subscription_end || '')}">⏳ ${esc(t('trial_banner', { n: days ?? '?' }))}</span>`;
  } else if (days !== null && days !== undefined && days <= 30) {
    subChip = `<span class="badge amber" title="${esc(t('sub_expiry'))}: ${esc(sub.subscription_end || '')}">⏳ ${esc(t(days === 1 ? 'sub_day_left' : 'sub_days_left', { n: days }))}</span>`;
  } else if (days !== null && days !== undefined) {
    subChip = `<span class="badge green" title="${esc(t('sub_expiry'))}: ${esc(sub.subscription_end || '')}">⏳ ${esc(t('sub_days_left', { n: days }))}</span>`;
  }

  const shell = el(`<div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <img src="/img/logo.jpeg" alt="logo" class="logo-img">
        <div><b>${esc(t('appName'))}</b><small>${esc(t('appTag'))}</small></div>
      </div>
      <nav class="nav" id="nav"></nav>
      <div class="sidebar-foot">
        <div class="user-card">
          <div class="avatar">${esc(initials)}</div>
          <div><b>${esc(App.me.user.name)}</b><span>${esc(App.me.company.name)}</span></div>
        </div>
        <button class="logout-btn-wide" id="logout-btn">${icon('logout')} ${esc(t('logout'))}</button>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebar-backdrop" hidden></div>
    <main class="main">
      <div class="topbar">
        <button class="icon-btn menu-btn" id="menu-btn" title="☰">☰</button>
        <h1 id="page-title"></h1>
        <span class="crumb" id="page-crumb"></span>
        <div class="spacer"></div>
        ${subChip}
        <span class="badge primary" title="${esc(t('base_cur_note', { cur: sub.base_currency }))}">${esc(sub.base_currency)}</span>
        <div class="bell-wrap" id="bell-wrap">
          <button class="icon-btn" id="bell-btn">${icon('bell')}<span class="bell-count" id="bell-count" hidden></span></button>
          <div class="bell-drop" id="bell-drop" hidden></div>
        </div>
        <button class="lang-pill" id="lang-btn">${esc(t('langLabel'))}</button>
      </div>
      <div class="content" id="view"></div>
    </main>
  </div>`);
  const appEl = document.getElementById('app');
  appEl.innerHTML = '';
  appEl.appendChild(shell);

  const nav = shell.querySelector('#nav');
  for (const g of groups) {
    if (g.label) nav.appendChild(el(`<div class="group">${esc(t(g.label))}</div>`));
    for (const [path, labelKey, ic] of g.items) {
      nav.appendChild(el(`<a href="#/${path}" data-path="${path}">${icon(ic)}<span>${esc(t(labelKey))}</span></a>`));
    }
  }
  shell.querySelector('#logout-btn').onclick = async () => {
    if (!(await confirmDlg(t('logout_confirm')))) return;
    try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
    setToken(null);
    showLogin();
  };
  shell.querySelector('#lang-btn').onclick = () => {
    setLang(getLang() === 'en' ? 'ar' : 'en');
    renderShell();
    route();
  };

  /* mobile drawer: hamburger + backdrop + auto-close on navigation */
  const sidebar = shell.querySelector('#sidebar');
  const backdrop = shell.querySelector('#sidebar-backdrop');
  const closeSidebar = () => {
    sidebar.classList.remove('open');
    backdrop.hidden = true;
    document.body.style.overflow = '';
  };
  shell.querySelector('#menu-btn').onclick = () => {
    const open = sidebar.classList.toggle('open');
    backdrop.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  };
  backdrop.onclick = closeSidebar;
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeSidebar(); });

  /* notification bell */
  const bellWrap = shell.querySelector('#bell-wrap');
  const bellBtn = shell.querySelector('#bell-btn');
  const bellDrop = shell.querySelector('#bell-drop');
  const bellCount = shell.querySelector('#bell-count');
  const loadNotifs = async (silent) => {
    try {
      const d = await api('/notifications');
      App.notifications = d.notifications;
      bellCount.hidden = !d.unread;
      bellCount.textContent = d.unread > 99 ? '99+' : d.unread;
      if (silent) return;
      bellDrop.innerHTML = `
        <div class="bell-head"><b>${esc(t('notif_title'))}</b>
          <button class="btn sm ghost" id="notif-read">${esc(t('notif_mark_read'))}</button></div>
        ${d.notifications.length ? d.notifications.map(n => `
          <div class="bell-item ${n.read ? '' : 'unread'}">
            <div class="bell-subject">${n.read ? '' : '<i class="dot"></i>'}${esc(n.subject)}</div>
            <div class="bell-msg">${esc(n.message)}</div>
            <div class="bell-meta">${esc(n.sender_name || '')} · ${esc(fmtDate(n.created_at))}</div>
          </div>`).join('') : `<div class="bell-empty">${esc(t('notif_empty'))}</div>`}`;
      bellDrop.querySelector('#notif-read').onclick = async () => {
        await api('/notifications/read-all', { method: 'POST' });
        loadNotifs();
      };
    } catch (e) { /* ignore */ }
  };
  bellBtn.onclick = async () => {
    const show = bellDrop.hidden;
    bellDrop.hidden = !show;
    if (show) { await loadNotifs(); await api('/notifications/read-all', { method: 'POST' }); loadNotifs(true); }
  };
  document.addEventListener('click', e => {
    if (!bellWrap.contains(e.target)) bellDrop.hidden = true;
  });
  loadNotifs(true);
}

/* ---------- Router ---------- */
const PAGES = {
  dashboard: DashboardPage,
  accounts: AccountsPage,
  journal: JournalPage,
  ledger: LedgerPage,
  trial: TrialPage,
  pnl: PnLPage,
  'balance-sheet': BalanceSheetPage,
  invoices: () => InvoicesPage('sale'),
  bills: () => InvoicesPage('purchase'),
  customers: () => ContactsPage('customer'),
  suppliers: () => ContactsPage('supplier'),
  inventory: InventoryPage,
  'inventory-print': InventoryPrintPage,
  transfers: TransfersPage,
  expenses: ExpensesPage,
  debts: DebtsPage,
  reports: ReportsPage,
  quotes: QuotesPage,
  settings: SettingsPage,
  admin: AdminPage,
};
const PAGE_CRUMBS = {
  dashboard: '', accounts: 'nav_accounting', journal: 'nav_accounting', ledger: 'nav_accounting',
  trial: 'nav_accounting', pnl: 'nav_accounting', 'balance-sheet': 'nav_accounting',
  invoices: 'nav_sales', quotes: 'nav_sales', bills: 'nav_purchases',
  customers: 'nav_sales', suppliers: 'nav_purchases', expenses: 'nav_purchases',
  inventory: 'nav_inventory', 'inventory-print': 'nav_inventory', transfers: 'nav_inventory',
  reports: 'nav_reports', debts: '', settings: '', admin: '',
};

function route() {
  if (!getToken()) return showLogin();
  const hash = location.hash.replace(/^#\//, '');
  const [path, param] = hash.split('/');
  // guard: admin panel is only for the platform admin
  if (path === 'admin' && !App.me.user.is_superadmin) {
    location.hash = '#/dashboard';
    return;
  }
  const entry = PAGES[path] || PAGES.dashboard;
  const page = () => (typeof entry === 'function' ? entry() : entry);
  const navLinks = document.querySelectorAll('#nav a');
  navLinks.forEach(a => a.classList.toggle('active', a.dataset.path === path));
  const view = document.getElementById('view');
  view.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">${esc(t('loading'))}</div>`;
  try {
    const inst = page();
    const title = inst.title ? inst.title() : t('nav_dashboard');
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = title;
    const crumb = PAGE_CRUMBS[path];
    const crumbEl = document.getElementById('page-crumb');
    if (crumbEl) crumbEl.textContent = crumb ? t(crumb) : '';
    const res = inst.render(view, param);
    if (res && typeof res.catch === 'function') {
      res.catch(e => {
        console.error(e);
        view.innerHTML = `<div class="card"><div class="card-body">${esc(e.message || t('err_generic'))}</div></div>`;
      });
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><div class="card-body">${esc(e.message || t('err_generic'))}</div></div>`;
  }
}

window.addEventListener('hashchange', () => {
  // close the mobile drawer on navigation
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  if (sb) { sb.classList.remove('open'); if (bd) bd.hidden = true; document.body.style.overflow = ''; }
  route();
});
window.addEventListener('unhandledrejection', e => console.error('Unhandled rejection:', e.reason));
document.addEventListener('DOMContentLoaded', boot);
