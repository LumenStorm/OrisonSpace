import { ipcMain, shell, type BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assertSafePath } from './pathGuard';

/**
 * Window IPC is registered once for the app lifetime. The active window is
 * resolved lazily via `getWin` so a recreated window (macOS dock re-activate)
 * is picked up without re-registering handlers — re-registering the same
 * channel throws "Attempted to register a second handler".
 */
export function registerWindowIpc(getWin: () => BrowserWindow | null) {
  ipcMain.on('window:minimize', () => getWin()?.minimize());

  ipcMain.on('window:maximize', () => {
    const win = getWin();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
  });

  ipcMain.on('window:close', () => getWin()?.close());

  ipcMain.handle('window:is-maximized', () => getWin()?.isMaximized() ?? false);

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

  // Open an external URL in the user's default browser. Restricted to https so
  // a renderer-supplied string can't trigger file://, javascript:, or other
  // schemes (potential local-resource access / abuse).
  ipcMain.on('shell:open-external', (_event, url: string) => {
    if (typeof url !== 'string') return;
    let parsed: URL;
    try { parsed = new URL(url); } catch { return; }
    if (parsed.protocol !== 'https:') return;
    void shell.openExternal(parsed.toString());
  });
}
