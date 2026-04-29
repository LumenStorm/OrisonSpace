import { ipcMain, shell, type BrowserWindow } from 'electron';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Validate that `target` is a descendant of (or equal to) `base`.
 * Prevents path-traversal attacks from the renderer.
 */
function isSafePath(base: string, target: string): boolean {
  const resolved = path.resolve(target);
  const resolvedBase = path.resolve(base);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

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

    if (!existsSync(fullPath)) {
      const dir = path.dirname(fullPath);
      mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, '', 'utf-8');
    }
    shell.showItemInFolder(fullPath);
  });

  // Open a directory in the system file manager
  ipcMain.on('shell:open-path', (_event, fullPath: string) => {
    if (typeof fullPath !== 'string' || fullPath.length === 0) return;
    if (!path.isAbsolute(fullPath)) return;

    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
    shell.openPath(fullPath);
  });
}
