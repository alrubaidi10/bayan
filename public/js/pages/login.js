/* Login — email + password only (accounts are created by the platform admin) */
const LoginPage = {
  render(container) {
    container.innerHTML = `
      <div class="login-card">
        <img src="/img/logo.jpeg" alt="Bayan" class="logo-big-img">
        <h1>${esc(t('appName'))}</h1>
        <div class="tagline">${esc(t('appTag'))}</div>
        <div id="login-error" class="login-error" hidden></div>
        <div id="login-form"></div>
      </div>`;
    this.showForm(container.querySelector('#login-form'));
  },

  showForm(host) {
    host.innerHTML = `
      <h3 style="font-size:17px;margin-bottom:4px">${esc(t('loginTitle'))}</h3>
      <p class="muted small" style="margin:0 0 16px">${esc(t('loginSub'))}</p>
      <div class="field" style="margin-bottom:12px">
        <label>${esc(t('email'))}</label>
        <input id="f-email" type="email" placeholder="${esc(t('emailPh'))}" autocomplete="username">
      </div>
      <div class="field" style="margin-bottom:16px">
        <label>${esc(t('password'))}</label>
        <input id="f-password" type="password" autocomplete="current-password">
      </div>
      <button class="btn primary" style="width:100%" id="submit-btn">${esc(t('login'))}</button>
      <div style="margin-top:16px;text-align:center">
        <button class="lang-pill" id="lang-btn">${esc(t('langLabel'))}</button>
      </div>`;

    const errBox = document.getElementById('login-error');
    const showErr = (code) => {
      errBox.hidden = false;
      errBox.textContent = t('err_' + code) || t('err_generic');
    };

    const email = host.querySelector('#f-email');
    const pass = host.querySelector('#f-password');
    const submit = host.querySelector('#submit-btn');
    const doSubmit = async () => {
      submit.disabled = true;
      errBox.hidden = true;
      try {
        const r = await api('/auth/login', { method: 'POST', body: { email: email.value.trim(), password: pass.value } });
        setToken(r.token);
        await boot();
      } catch (e) {
        if (e.message === 'account_suspended' || e.message === 'account_expired') showBlocked(e.message);
        else showErr(e.message);
        submit.disabled = false;
      }
    };
    submit.onclick = doSubmit;
    pass.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });

    host.querySelector('#lang-btn').onclick = () => { setLang(getLang() === 'en' ? 'ar' : 'en'); this.render(document.querySelector('#login-card')); };
  },
};
