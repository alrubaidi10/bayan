/* API client with auth token handling */
const TOKEN_KEY = 'mizan_token';

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(tk) { tk ? localStorage.setItem(TOKEN_KEY, tk) : localStorage.removeItem(TOKEN_KEY); }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const tk = getToken();
  if (tk) headers['Authorization'] = 'Bearer ' + tk;
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data = {};
  try { data = await res.json(); } catch (e) { /* empty */ }

  if (res.status === 401) {
    if (path === '/auth/login') {
      throw new Error(data.error || 'bad_credentials');
    }
    setToken(null);
    if (!location.hash.includes('login')) {
      location.hash = '#/login';
    }
    throw new Error(data.error || 'unauthorized');
  }

  if (!res.ok) {
    const code = data.error || 'generic_error';
    if (code === 'account_suspended' || code === 'account_expired') {
      setToken(null);
      if (window.showBlocked) window.showBlocked(code);
    }
    throw new Error(code);
  }
  return data;
}
