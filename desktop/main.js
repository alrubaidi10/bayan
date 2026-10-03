const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

// Function to copy directory recursively
function copyDirectory(src, dest) {
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } catch (err) {
    console.error('[Desktop] Error copying directory:', err);
  }
}

// ============================================================
// بيان ERP — Desktop Architecture
// الواجهة: سيرفر محلي مضمّن (يضمن تحديث الـ UI فوراً بعد تثبيت EXE جديد)
// قاعدة البيانات: SQLite محلي + Firebase مباشر (للعملاء الجدد والمزامنة)
// ============================================================
const SERVER_PORT = 34567;
const FIREBASE_MODE = 'embedded'; // embedded: مدمج مع Firebase مباشر

let mainWindow   = null;
let splashWindow = null;

// Ensure single instance
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

// ── تشغيل السيرفر المحلي ─────────────────────────────────────
function startEmbeddedServer() {
  const userDataDir = app.getPath('userData');
  const dbDir = path.join(userDataDir, 'database');
  const serverDir = path.join(userDataDir, 'server');
  
  // Copy server files to userData for each user
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Copy server directory if not exists
    const sourceServer = path.join(__dirname, '..', 'server');
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
      copyDirectory(sourceServer, serverDir);
    }
    
    // Copy firebase config if exists
    const sourceFirebase = path.join(__dirname, '..', 'server', 'firebase-service-account.json');
    if (fs.existsSync(sourceFirebase)) {
      const destFirebase = path.join(serverDir, 'firebase-service-account.json');
      if (!fs.existsSync(destFirebase)) {
        fs.copyFileSync(sourceFirebase, destFirebase);
      }
    }
  } catch (e) {
    console.warn('[Desktop] Could not copy server files:', e.message);
  }
  
  process.env.DATA_DIR   = dbDir;
  process.env.PORT       = String(SERVER_PORT);
  process.env.DESKTOP_MODE = '1';
  process.env.FIREBASE_MODE = 'embedded';

  try {
    const appBuildEntry = path.join(__dirname, 'app-build', 'server', 'index.js');
    if (require('fs').existsSync(appBuildEntry)) {
      try {
        // حاول تحميل الكود المحمي (Bytecode)
        require('bytenode');
        require(appBuildEntry);
        console.log('[Desktop] Loaded protected bytecode server.');
        return;
      } catch (bytecodeErr) {
        // إذا رُفض الـ Bytecode (اختلاف نسخة V8/Electron) انتقل للكود العادي تلقائياً
        console.warn('[Desktop] Bytecode rejected (V8 mismatch), falling back to source JS:', bytecodeErr.message);
      }
    }
    // الكود الأصلي من extraResources — دائماً موجود خارج الـ asar
    const fallbackServer = path.join(process.resourcesPath, 'server', 'index.js');
    require(fallbackServer);
    console.log('[Desktop] Loaded fallback server from extraResources.');
  } catch (err) {
    console.error('[Desktop] Failed to start server:', err);
    dialog.showErrorBox('خطأ في تشغيل النظام', 'تعذر تشغيل الخادم الداخلي:\n' + err.message);
  }
}

// ── انتظار استجابة السيرفر المحلي ───────────────────────────
function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode < 500) { resolve(true); return; }
        retry();
        res.resume();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) { resolve(false); }
      else setTimeout(check, 300);
    };
    check();
  });
}

// ── شاشة التحميل ─────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460, height: 280, frame: false,
    transparent: false, resizable: false,
    alwaysOnTop: true, center: true,
    backgroundColor: '#0f172a',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(135deg,#0f172a,#1e293b);display:flex;flex-direction:column;
         align-items:center;justify-content:center;height:100vh;font-family:'Segoe UI',Arial,sans-serif;color:#fff}
    .logo{font-size:48px;margin-bottom:10px}
    h1{font-size:26px;font-weight:700;margin-bottom:4px}
    .sub{font-size:12px;color:#94a3b8;margin-bottom:28px}
    .spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,.15);
             border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:12px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .msg{font-size:12px;color:#64748b}
  </style></head><body>
    <div class="logo">📊</div>
    <h1>بيان ERP</h1>
    <div class="sub">نظام إدارة المبيعات والمخزون</div>
    <div class="spinner"></div>
    <div class="msg">جارٍ تحميل النظام…</div>
  </body></html>`;

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  splashWindow.show();
}

function destroySplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
}

// ── النافذة الرئيسية ──────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360, height: 840,
    minWidth: 1024, minHeight: 700,
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

  // افتح روابط خارجية (واتساب، إنستغرام) في المتصفح الافتراضي
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // اعترض نقرات الروابط الخارجية أيضاً
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const localUrl = `http://127.0.0.1:${SERVER_PORT}`;
    if (!url.startsWith(localUrl)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);

  mainWindow.once('ready-to-show', () => {
    destroySplash();
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── التهيئة الرئيسية ──────────────────────────────────────────
async function initApp() {
  createSplashWindow();
  startEmbeddedServer();

  await waitForServer(`http://127.0.0.1:${SERVER_PORT}/api/health`, 12000);
  createMainWindow();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
