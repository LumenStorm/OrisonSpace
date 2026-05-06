import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { registerProjectIpc } from './ipc/projectIpc';
import { registerWindowIpc } from './ipc/windowIpc';
import { registerConfigIpc } from './ipc/configIpc';
import { registerFieldSyncIpc } from './ipc/fieldSyncIpc';
import { registerModelProviderIpc } from './ipc/modelProviderIpc';
import { registerModelGatewayIpc } from './ipc/modelGatewayIpc';
import { registerStorySyncIpc } from './ipc/storySyncIpc';

/* ── CSP ── */

const isDev = !!process.env.ELECTRON_RENDERER_URL;

const CSP = [
  "default-src 'self'",
  // Dev: Vite HMR needs 'unsafe-eval' for source maps and inline scripts
  isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  `connect-src 'self' ${isDev ? 'http://localhost:4000 ws://localhost:* https:' : 'https:'}`,
].join('; ');

function createWindow() {
  const isMac = process.platform === 'darwin';

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    frame: isMac,                          // Windows/Linux 隐藏原生标题栏
    titleBarStyle: isMac ? 'hidden' : undefined, // macOS 保留红绿灯
    trafficLightPosition: isMac ? { x: 12, y: 10 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Inject CSP via response headers — only in production builds.
  // In dev mode the renderer is served by Vite dev server on localhost,
  // and 'self' would not match the dev-server origin, blocking all scripts.
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP],
        },
      });
    });
  }

  registerProjectIpc();
  registerWindowIpc(mainWindow);
  registerConfigIpc();
  registerModelProviderIpc();
  registerModelGatewayIpc();
  registerStorySyncIpc();
  registerFieldSyncIpc();

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
