import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import path from 'node:path';
import { getLogger, installGlobalErrorHandlers } from './logger';
import { registerProjectIpc } from './ipc/projectIpc';
import { registerWindowIpc } from './ipc/windowIpc';
import { registerConfigIpc, readUserPreferencesFromDisk } from './ipc/configIpc';
import { registerFieldSyncIpc } from './ipc/fieldSyncIpc';
import { registerModelProviderIpc } from './ipc/modelProviderIpc';
import { registerModelGatewayIpc } from './ipc/modelGatewayIpc';
import { registerStorySyncIpc } from './ipc/storySyncIpc';
import { registerTaskIpc } from './ipc/taskIpc';
import { registerAssetIpc } from './ipc/assetIpc';
import { registerLogIpc } from './ipc/logIpc';
import { registerUpdateIpc, checkForUpdateOnStartup } from './ipc/updateIpc';
import { registerGitIpc } from './ipc/gitIpc';
import { registerAgentIpc } from './ipc/agentIpc';
import { registerOrchestrationIpc } from './ipc/orchestrationIpc';
import { fetchOrisonFile } from './orisonFileProtocol';
import { closeDb } from './db';

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

// The single live window. IPC handlers that need a window resolve it lazily via
// `getMainWindow()` so they can be registered ONCE for the app lifetime — a
// recreated window (macOS dock re-activate) is picked up automatically. Calling
// ipcMain.handle twice for the same channel throws, which previously crashed the
// app when a second window was created.
let mainWindow: BrowserWindow | null = null;
const getMainWindow = (): BrowserWindow | null => mainWindow;

let cspInstalled = false;
let ipcRegistered = false;

/** Register every IPC handler exactly once. Window-bound ones use getMainWindow. */
function registerAllIpc() {
  if (ipcRegistered) return;
  ipcRegistered = true;
  registerProjectIpc();
  registerWindowIpc(getMainWindow);
  registerConfigIpc();
  registerModelProviderIpc();
  registerModelGatewayIpc();
  registerStorySyncIpc();
  registerFieldSyncIpc();
  registerTaskIpc();
  registerAssetIpc();
  registerLogIpc();
  registerUpdateIpc(getMainWindow);
  registerGitIpc();
  registerAgentIpc(getMainWindow);
  registerOrchestrationIpc();
}

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
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

  const win = mainWindow;

  // Inject CSP via response headers — only in production builds, and only once
  // (the listener is on the shared defaultSession, so re-adding it per window
  // would stack duplicate handlers).
  if (!isDev && !cspInstalled) {
    cspInstalled = true;
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP],
        },
      });
    });
  }

  // Prevent Chromium from swallowing shortcuts we handle in the renderer
  const passthroughKeys = new Set(['Tab', 'n', 'w', 't']);
  win.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && passthroughKeys.has(input.key)) {
      event.preventDefault();
    }
  });

  // Guard window close — ask renderer to check for unsaved files
  let forceClose = false;
  win.on('close', (e) => {
    if (forceClose) return;
    e.preventDefault();
    win.webContents.send('app:before-close');
  });
  const onCloseConfirmed = (event: Electron.IpcMainEvent) => {
    // Only react to the confirmation from this window's renderer.
    if (event.sender !== win.webContents) return;
    forceClose = true;
    win.close();
  };
  ipcMain.on('app:close-confirmed', onCloseConfirmed);
  win.on('closed', () => {
    ipcMain.removeListener('app:close-confirmed', onCloseConfirmed);
    if (mainWindow === win) mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Silent update check on startup (packaged builds only). The renderer
  // surfaces a guided prompt only if a newer version is found. Delay so the
  // window/renderer is ready to receive the `update:event` stream.
  if (readUserPreferencesFromDisk().autoCheckUpdates !== false) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => void checkForUpdateOnStartup(), 5000);
    });
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
  registerAllIpc();
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

// Release the SQLite handle on quit. In WAL mode an open handle keeps a file
// lock that, on Windows, blocks deleting/reopening the DB file. Without this the
// connection only closed in tests, never on real app exit.
app.on('will-quit', () => {
  try {
    closeDb();
  } catch (err) {
    getLogger().warn({ err: err instanceof Error ? err.message : String(err) }, 'closeDb on quit failed');
  }
});
