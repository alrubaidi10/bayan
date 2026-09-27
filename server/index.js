const express = require('express');
const path = require('path');
const app = express();

// CORS — allows serving the API from a different origin
// (e.g. frontend hosted on Netlify + API on Render, or a custom domain)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

/* Health check — returns 200 so Render's health check passes */
app.get('/api/health', (req, res) => res.json({ ok: true, status: 'up', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/core'));
app.use('/api', require('./routes/sales'));
app.use('/api', require('./routes/misc'));
app.use('/api', require('./routes/quotes'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/stock-transfers', require('./routes/transfers'));
app.use('/api/admin', require('./routes/admin'));

// ensure the platform super-admin exists (admin@mizan.local / admin1234)
require('./seed').ensureSuperAdmin();

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  const dataDir = process.env.DATA_DIR || './data';
  console.log(`Bayan ERP listening on http://0.0.0.0:${PORT}`);
  console.log(`SQLite database: ${dataDir}/erp.db`);
  if (process.env.DATA_DIR) console.log(`Persistent storage OK (DATA_DIR=${dataDir})`);
  else console.warn('WARNING: DATA_DIR not set — database is ephemeral and will be LOST on redeploy. Set DATA_DIR to a persistent volume!');
});
