import { dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function registerProjectIpc() {
  ipcMain.handle('project:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('project:create-directory', async (_, parentDir: string, name: string) => {
    const projectDir = path.join(parentDir, name);
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }
    return projectDir;
  });

  ipcMain.handle('project:pick-cover-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('project:copy-cover-image', async (_, src: string, projectDir: string) => {
    const ext = path.extname(src);
    const dest = path.join(projectDir, `cover${ext}`);
    copyFileSync(src, dest);
    return dest;
  });

  ipcMain.handle('project:save-meta', async (_, projectDir: string, meta: Record<string, unknown>) => {
    const metaPath = path.join(projectDir, 'project.json');
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  });

  ipcMain.handle('project:load-meta', async (_, projectDir: string) => {
    const metaPath = path.join(projectDir, 'project.json');
    try {
      if (!existsSync(metaPath)) return null;
      return JSON.parse(readFileSync(metaPath, 'utf-8'));
    } catch {
      return null;
    }
  });
}
