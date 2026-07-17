import { dialog, ipcMain, shell } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { RegisteredProject } from '@orison/shared-contracts';
import { allowPath, assertSafePath, getOrisonSpaceRoot } from './pathGuard';
import { watchProject, unwatchProject } from '../fs/projectWatcher';
import { ensureProject, getProject, listProjects, touchProject } from '../db/projectRepository';
import { registerProjectFileIpc } from './projectFileIpc';
import { registerProjectMetaIpc } from './projectMetaIpc';
import { deleteProject, duplicateProject, renameProject } from './projectLifecycle';
import { withProjectLock } from '../fs/projectWriteLock';
import { loadVerifiedProjectDocument } from './projectIdentity';

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
  ipcMain.handle('project:ensure-registration', async (_, input: { projectId?: string; name: string; type: 'novel' | 'script'; localFingerprint: string; path?: string; coverImage?: string }) => {
    const localFingerprint = path.resolve(input.localFingerprint);
    const projectPath = path.resolve(input.path ?? input.localFingerprint);
    if (localFingerprint !== projectPath) throw new Error('Project fingerprint must match project path');
    assertSafePath(projectPath);
    let projectId = input.projectId;
    const existing = getProject(projectPath);
    if (existing && !existing.deletedAt) {
      const document = await withProjectLock(projectPath, () =>
        loadVerifiedProjectDocument(projectPath, existing));
      if (document) projectId = existing.projectId;
    }
    if (projectId) {
      const { loadProject } = await import('@orison/desktop-local-bff');
      const document = loadProject(projectPath);
      if (document?.meta.project_id !== projectId) projectId = undefined;
    }
    const record = ensureProject({ ...input, projectId, localFingerprint, path: projectPath });
    return { projectId: record.projectId, name: record.name, type: record.type };
  });

  // Durable project list for ProjectsPage (survives app version changes / reinstalls).
  ipcMain.handle('project:list-registered', async () => {
    const projects: RegisteredProject[] = [];
    for (const r of listProjects()) {
      const projectPath = path.resolve(r.path ?? r.localFingerprint);
      try {
        const document = await withProjectLock(projectPath, () =>
          loadVerifiedProjectDocument(projectPath, r));
        if (!document) continue;
        projects.push({
          projectId: r.projectId,
          name: r.name,
          type: r.type,
          path: allowPath(projectPath),
          coverImage: r.coverImage,
          lastOpenedAt: r.lastOpenedAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        });
      } catch {
        continue;
      }
    }
    return projects;
  });

  ipcMain.handle('project:touch-registration', async (_, input: { localFingerprint: string; coverImage?: string }) => {
    touchProject(input);
  });

  ipcMain.handle('project:duplicate', async (_, projectPath: string, name: string) => {
    return duplicateProject(projectPath, name);
  });

  ipcMain.handle('project:rename', async (_, projectPath: string, name: string) => {
    return renameProject(projectPath, name);
  });

  ipcMain.handle('project:delete', async (_, projectPath: string) => {
    return deleteProject(projectPath, (target) => shell.trashItem(target));
  });

  /* ── Filesystem watcher (auto-refresh on external changes) ── */
  ipcMain.handle('project:watch', async (_, projectDir: string) => {
    watchProject(projectDir);
  });

  ipcMain.handle('project:unwatch', async () => {
    unwatchProject();
  });
}
