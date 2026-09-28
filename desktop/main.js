const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = 34567; // Local embedded server port

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

function startEmbeddedServer() {
  // Set custom persistent storage path in user's AppData
  const userDataDir = app.getPath('userData');
  const dbDir = path.join(userDataDir, 'database');
  process.env.DATA_DIR = dbDir;
  process.env.PORT = String(SERVER_PORT);

  // Require compiled or standard server
  try {
    const appBuildEntry = path.join(__dirname, 'app-build', 'server', 'index.js');
    if (require('fs').existsSync(appBuildEntry)) {
      require('bytenode');
      require(appBuildEntry);
      console.log('[Desktop] Loaded protected bytecode server from app-build.');
      return;
    }

    require(path.join(__dirname, '..', 'server', 'index.js'));
    console.log('[Desktop] Loaded standard server.');
  } catch (err) {
    console.error('[Desktop] Failed to start server:', err);
    dialog.showErrorBox('خطأ في تشغيل النظام', 'تعذر تشغيل الخادم الداخلي: ' + err.message);
  }
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 404) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Server boot timeout'));
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

async function initApp() {
  // Start local server silently
  startEmbeddedServer();

  // Create Window
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'بيان ERP — نظام إدارة المبيعات والمخزون',
    icon: path.join(__dirname, '..', 'public', 'img', 'logo.jpeg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false // Locked in production for client security
    },
    autoHideMenuBar: true
  });

  Menu.setApplicationMenu(null); // Hide default menu

  const appUrl = `http://127.0.0.1:${SERVER_PORT}`;

  try {
    await waitForServer(`http://127.0.0.1:${SERVER_PORT}/api/health`, 12000);
    mainWindow.loadURL(appUrl);
  } catch (err) {
    console.warn('[Desktop] Wait server timeout, loading URL directly...');
    mainWindow.loadURL(appUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
