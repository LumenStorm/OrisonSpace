import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import path from 'node:path';
import { getLogger, installGlobalErrorHandlers } from './logger';
import { registerProjectIpc } from './ipc/projectIpc';
import { registerWindowIpc } from './ipc/windowIpc';
import { registerConfigIpc } from './ipc/configIpc';
import { registerFieldSyncIpc } from './ipc/fieldSyncIpc';
import { registerModelProviderIpc } from './ipc/modelProviderIpc';
import { registerModelGatewayIpc } from './ipc/modelGatewayIpc';
import { registerStorySyncIpc } from './ipc/storySyncIpc';
import { registerTaskIpc } from './ipc/taskIpc';
import { registerAssetIpc } from './ipc/assetIpc';
import { registerLogIpc } from './ipc/logIpc';
import { registerUpdateIpc } from './ipc/updateIpc';
import { registerGitIpc } from './ipc/gitIpc';
import { registerAgentIpc } from './ipc/agentIpc';
import { registerOrchestrationIpc } from './ipc/orchestrationIpc';
import { fetchOrisonFile } from './orisonFileProtocol';

/* ── CSP ── */

const isDev = !!process.env.ELECTRON_RENDERER_URL;

// App icon (Windows/Linux runtime window + taskbar). macOS uses the bundled
// .icns from electron-builder, so a runtime icon is not needed there.
// `resources/` is copied next to the app via electron-builder `files`, and in
// dev it sits two levels up from dist/main. Prefer the .ico on Windows for
// crisp taskbar rendering, the .png elsewhere.
function resolveAppIcon(): string {
  const base = path.join(__dirname, '../../resources');
  return process.platform === 'win32'
    ? path.join(base, 'icon.ico')
    : path.join(base, 'icon.png');
}

const CSP = [
  "default-src 'self'",
  isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: orison-file: https:",
  `connect-src 'self' ${isDev ? 'ws://localhost:* https:' : 'https:'}`,
].join('; ');

function createWindow() {
  const isMac = process.platform === 'darwin';

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    icon: isMac ? undefined : resolveAppIcon(),
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
  registerTaskIpc();
  registerAssetIpc();
  registerLogIpc();
  registerUpdateIpc();
  registerGitIpc();
  registerAgentIpc(mainWindow);
  registerOrchestrationIpc();

  // Prevent Chromium from swallowing shortcuts we handle in the renderer
  const passthroughKeys = new Set(['Tab', 'n', 'w', 't']);
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && passthroughKeys.has(input.key)) {
      event.preventDefault();
    }
  });

  // Guard window close — ask renderer to check for unsaved files
  let forceClose = false;
  mainWindow.on('close', (e) => {
    if (forceClose) return;
    e.preventDefault();
    mainWindow.webContents.send('app:before-close');
  });
  ipcMain.on('app:close-confirmed', () => {
    forceClose = true;
    mainWindow.close();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

/* ── Custom protocol for serving local project files ── */
protocol.registerSchemesAsPrivileged([
  { scheme: 'orison-file', privileges: { standard: false, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  // Register orison-file:// protocol to serve local files from sandbox
  protocol.handle('orison-file', (request) => {
    return fetchOrisonFile(request.url);
  });

  installGlobalErrorHandlers();
  getLogger().info({ platform: process.platform, version: app.getVersion() }, 'desktop main starting');
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
