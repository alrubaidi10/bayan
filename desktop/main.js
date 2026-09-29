const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');

// ============================================================
// الحل الأول: السحابة المركزية الموحدة (Single Source of Truth)
// تطبيق الديسكتوب يتصل مباشرة بالسيرفر السحابي على Render
// بحيث يشارك اللابتوب والجوال نفس قاعدة البيانات الحية
// ============================================================
const CLOUD_URL = 'https://bayan-alp6.onrender.com';

let mainWindow = null;
let splashWindow = null;

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(initApp);
}

// ── شاشة التحميل (Splash Screen) ────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#1a1a2e',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100vh; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          color: white; overflow: hidden;
        }
        .logo { font-size: 52px; margin-bottom: 12px; }
        h1 { font-size: 28px; font-weight: 700; margin-bottom: 6px; letter-spacing: 1px; }
        .sub { font-size: 13px; color: #a0aec0; margin-bottom: 32px; }
        .spinner-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .spinner {
          width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.2);
          border-top-color: #4299e1; border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .status { font-size: 13px; color: #90cdf4; text-align: center; animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .bar-wrap { width: 280px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 8px; }
        .bar { height: 4px; background: linear-gradient(90deg,#4299e1,#63b3ed); border-radius: 2px; width: 0%; animation: load 20s ease-out forwards; }
        @keyframes load { 0%{width:5%} 30%{width:40%} 70%{width:75%} 95%{width:92%} 100%{width:95%} }
      </style>
    </head>
    <body>
      <div class="logo">📊</div>
      <h1>بيان ERP</h1>
      <div class="sub">نظام إدارة المبيعات والمخزون</div>
      <div class="spinner-wrap">
        <div class="spinner"></div>
        <div class="status">جارٍ الاتصال بالسيرفر السحابي…</div>
        <div class="bar-wrap"><div class="bar"></div></div>
      </div>
    </body>
    </html>
  `;

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml));
  splashWindow.show();
}

// ── التحقق من جاهزية السيرفر السحابي ────────────────────────
function waitForCloud(timeoutMs = 60000) {
  const start = Date.now();
  const url = new URL(CLOUD_URL + '/api/health');

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = https.get({
        hostname: url.hostname,
        path: url.pathname,
        timeout: 8000
      }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
        res.resume();
      });
      req.on('error', retry);
      req.on('timeout', () => { req.abort(); retry(); });
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error('timeout'));
      } else {
        setTimeout(check, 2000);
      }
    };

    check();
  });
}

// ── النافذة الرئيسية ─────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'بيان ERP — نظام إدارة المبيعات والمخزون',
    icon: path.join(__dirname, '..', 'public', 'img', 'logo.jpeg'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false
    },
    autoHideMenuBar: true
  });

  Menu.setApplicationMenu(null);

  // فتح الروابط الخارجية في المتصفح الافتراضي
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(CLOUD_URL)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(CLOUD_URL);

  mainWindow.once('ready-to-show', () => {
    // أغلق شاشة التحميل وأظهر النافذة الرئيسية
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // إذا فشل التحميل، أظهر خطأ واضحاً
  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    if (code === -3) return; // ERR_ABORTED (normal navigation)
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
      <style>body{font-family:'Segoe UI',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7fafc;color:#2d3748;}
      h2{color:#e53e3e;margin-bottom:12px}p{color:#718096;font-size:14px;text-align:center;max-width:400px}
      button{margin-top:24px;padding:10px 28px;background:#4299e1;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer;border-radius:6px}
      button:hover{background:#3182ce}</style></head>
      <body>
        <div style="font-size:48px;margin-bottom:16px">🌐</div>
        <h2>تعذّر الاتصال بالسيرفر</h2>
        <p>تأكد من اتصال الإنترنت ثم أعد المحاولة.<br>كود الخطأ: ${code}</p>
        <button onclick="location.href='${CLOUD_URL}'">🔄 إعادة المحاولة</button>
      </body></html>
    `));
  });
}

// ── التهيئة الرئيسية ──────────────────────────────────────────
async function initApp() {
  createSplashWindow();

  try {
    await waitForCloud(55000);
  } catch (err) {
    // إذا فاق وقت الانتظار، افتح على أي حال (قد يكون جاهزاً)
    console.warn('[Desktop] Cloud wait timeout — loading anyway:', err.message);
  }

  createMainWindow();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
