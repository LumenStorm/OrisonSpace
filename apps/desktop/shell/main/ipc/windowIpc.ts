import { ipcMain, type BrowserWindow } from 'electron';

export function registerWindowIpc(win: BrowserWindow) {
  ipcMain.on('window:minimize', () => win.minimize());

  ipcMain.on('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.on('window:close', () => win.close());

  ipcMain.handle('window:is-maximized', () => win.isMaximized());
}
