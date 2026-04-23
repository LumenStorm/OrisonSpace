import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerProjectIpc } from './ipc/projectIpc';
import { registerWindowIpc } from './ipc/windowIpc';

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

  registerProjectIpc();
  registerWindowIpc(mainWindow);

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
