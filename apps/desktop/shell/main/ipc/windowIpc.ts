import { ipcMain, shell, type BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assertSafePath } from './pathGuard';

export function registerWindowIpc(win: BrowserWindow) {
  ipcMain.on('window:minimize', () => win.minimize());

  ipcMain.on('window:maximize', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.on('window:close', () => win.close());

  ipcMain.handle('window:is-maximized', () => win.isMaximized());

  // Reveal a file in the system file manager
  ipcMain.on('shell:show-item-in-folder', (_event, fullPath: string) => {
    if (typeof fullPath !== 'string' || fullPath.length === 0) return;
    if (!path.isAbsolute(fullPath)) return;
    try { assertSafePath(fullPath); } catch { return; }
    if (!existsSync(fullPath)) return;
    shell.showItemInFolder(fullPath);
  });

  // Open a directory in the system file manager
  ipcMain.on('shell:open-path', (_event, fullPath: string) => {
    if (typeof fullPath !== 'string' || fullPath.length === 0) return;
    if (!path.isAbsolute(fullPath)) return;
    try { assertSafePath(fullPath); } catch { return; }
    if (!existsSync(fullPath)) return;
    shell.openPath(fullPath);
  });
}
