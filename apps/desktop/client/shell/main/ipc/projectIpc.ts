import { dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { allowPath, getOrisonSpaceRoot } from './pathGuard';
import { watchProject, unwatchProject } from '../fs/projectWatcher';
import { ensureProject, listProjects, touchProject } from '../db/projectRepository';
import { registerProjectFileIpc } from './projectFileIpc';
import { registerProjectMetaIpc } from './projectMetaIpc';

export function registerProjectIpc() {
  const orisonSpaceRoot = getOrisonSpaceRoot();
  if (!existsSync(orisonSpaceRoot)) {
    mkdirSync(orisonSpaceRoot, { recursive: true });
  }

  /* ── Dialog-based (user picks path via OS dialog — inherently safe) ── */

  ipcMain.handle('project:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      defaultPath: orisonSpaceRoot,
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : allowPath(result.filePaths[0]);
  });

  ipcMain.handle('project:pick-cover-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }
      ]
    });
    return result.canceled ? null : allowPath(result.filePaths[0]);
  });

  /* ── Project-scoped file operations ── */
  registerProjectFileIpc();

  /* ── Meta sync, docx import/conversion, recursive directory read ── */
  registerProjectMetaIpc();

  /* ── Local project registration (SQLite) ── */
  ipcMain.handle('project:ensure-registration', async (_, input: { name: string; type: 'novel' | 'script'; localFingerprint: string; path?: string; coverImage?: string }) => {
    const record = ensureProject(input);
    return { projectId: record.projectId, name: record.name, type: record.type };
  });

  // Durable project list for ProjectsPage (survives app version changes / reinstalls).
  ipcMain.handle('project:list-registered', async () => {
    return listProjects().map((r) => ({
      projectId: r.projectId,
      name: r.name,
      type: r.type,
      path: r.path ?? r.localFingerprint,
      coverImage: r.coverImage,
      lastOpenedAt: r.lastOpenedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  });

  ipcMain.handle('project:touch-registration', async (_, input: { localFingerprint: string; coverImage?: string }) => {
    touchProject(input);
  });

  /* ── Filesystem watcher (auto-refresh on external changes) ── */
  ipcMain.handle('project:watch', async (_, projectDir: string) => {
    watchProject(projectDir);
  });

  ipcMain.handle('project:unwatch', async () => {
    unwatchProject();
  });
}
