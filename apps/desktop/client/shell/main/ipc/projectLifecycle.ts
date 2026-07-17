import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, lstat, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectLifecycleResult, RegisteredProject } from '@orison/shared-contracts';
import { allowPath, assertSafePath, getOrisonSpaceRoot, isSafePath, revokePath } from './pathGuard';
import { withProjectLock } from '../fs/projectWriteLock';
import { getLogger } from '../logger';
import {
  archiveProject,
  ensureProject,
  getProject,
  purgeProject,
  renameProject as renameProjectRegistration,
  type ProjectRecord,
} from '../db/projectRepository';
import { loadVerifiedProjectDocument } from './projectIdentity';

const INVALID_PROJECT_NAME = /[<>:"/\\|?*]/;
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const COPY_EXCLUDED_PATHS = [
  '.git',
  '.orison/sessions',
  '.orison/artifacts',
  '.orison/history',
];

type TrashItem = (projectPath: string) => Promise<void>;

export async function duplicateProject(
  sourcePathInput: string,
  nameInput: string,
): Promise<ProjectLifecycleResult> {
  const sourcePath = path.resolve(sourcePathInput);
  const name = normalizeProjectName(nameInput);
  if (!name) return { ok: false, error: 'invalid-name' };

  try {
    assertSafePath(sourcePath);
  } catch (error) {
    logLifecycleFailure('duplicate', sourcePath, 'path-guard', error);
    return { ok: false, error: 'operation-failed' };
  }

  if (!(await isDirectory(sourcePath))) return { ok: false, error: 'not-found' };
  let sourceRegistration: ProjectRecord | undefined;
  try {
    sourceRegistration = getProject(sourcePath);
  } catch (error) {
    logLifecycleFailure('duplicate', sourcePath, 'read-source-registration', error);
    return { ok: false, error: 'operation-failed' };
  }
  if (!sourceRegistration || sourceRegistration.deletedAt) return { ok: false, error: 'not-found' };
  const registration = sourceRegistration;

  const targetPath = path.join(path.dirname(sourcePath), name);
  let targetRegistration: ProjectRecord | undefined;
  try {
    targetRegistration = getProject(targetPath);
  } catch (error) {
    logLifecycleFailure('duplicate', sourcePath, 'read-target-registration', error, { targetPath });
    return { ok: false, error: 'operation-failed' };
  }
  if (path.resolve(targetPath) === sourcePath || existsSync(targetPath) || targetRegistration) {
    return { ok: false, error: 'name-exists' };
  }

  let registered = false;
  try {
    return await withProjectLock(sourcePath, async () => {
      const { createEmptyProjectDocument, loadProject, migrateLegacyProjectJson, saveProject } =
        await import('@orison/desktop-local-bff');
      const sourceDocument = await loadVerifiedProjectDocument(sourcePath, registration);
      if (!sourceDocument) {
        return { ok: false, error: 'not-found' };
      }

      await cp(sourcePath, targetPath, {
        recursive: true,
        errorOnExist: true,
        force: false,
        filter: (source) => shouldCopyPath(sourcePath, source),
      });
      allowPath(targetPath);

      const document = migrateLegacyProjectJson(targetPath)
        ?? loadProject(targetPath)
        ?? createEmptyProjectDocument(name, registration.type);
      const next = structuredClone(document);
      const now = new Date().toISOString();
      const coverImage = remapProjectFile(document.meta.cover_image, sourcePath, targetPath);

      next.meta.id = randomUUID();
      next.meta.name = name;
      next.meta.created_at = now;
      next.meta.updated_at = now;
      next.meta.version = 0;
      if (coverImage) next.meta.cover_image = coverImage;
      else delete next.meta.cover_image;

      const record = ensureProject({
        name,
        type: next.meta.type,
        localFingerprint: targetPath,
        path: targetPath,
        coverImage,
        logline: next.meta.logline,
        genre: next.meta.genre,
        writingStyle: next.meta.writing_style,
      });
      registered = true;
      next.meta.project_id = record.projectId;
      saveProject(targetPath, next);

      return { ok: true, project: toRegisteredProject(record) };
    });
  } catch (error) {
    if (registered) {
      try {
        purgeProject(targetPath);
      } catch {
        try { archiveProject(targetPath); } catch { /* 最终仍会清理磁盘副本 */ }
      }
    }
    await rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
    revokePath(targetPath);
    logLifecycleFailure('duplicate', sourcePath, 'copy-or-register', error, { targetPath });
    return { ok: false, error: 'operation-failed' };
  }
}

export async function renameProject(
  projectPathInput: string,
  nameInput: string,
): Promise<ProjectLifecycleResult> {
  const projectPath = path.resolve(projectPathInput);
  const name = normalizeProjectName(nameInput);
  if (!name) return { ok: false, error: 'invalid-name' };

  try {
    assertSafePath(projectPath);
  } catch (error) {
    logLifecycleFailure('rename', projectPath, 'path-guard', error);
    return { ok: false, error: 'operation-failed' };
  }
  if (!(await isDirectory(projectPath))) return { ok: false, error: 'not-found' };
  let existing: ProjectRecord | undefined;
  try {
    existing = getProject(projectPath);
  } catch (error) {
    logLifecycleFailure('rename', projectPath, 'read-registration', error);
    return { ok: false, error: 'operation-failed' };
  }
  if (!existing || existing.deletedAt) return { ok: false, error: 'not-found' };
  const registration = existing;

  try {
    return await withProjectLock(projectPath, async () => {
      const { saveProject } = await import('@orison/desktop-local-bff');
      const document = await loadVerifiedProjectDocument(projectPath, registration);
      if (!document) {
        return { ok: false, error: 'not-found' };
      }
      const next = structuredClone(document);
      next.meta.name = name;
      next.meta.project_id = registration.projectId;
      next.meta.updated_at = new Date().toISOString();
      next.meta.version = (next.meta.version ?? 0) + 1;

      saveProject(projectPath, next);
      const record = renameProjectRegistration(projectPath, name);
      if (!record) {
        saveProject(projectPath, document);
        throw new Error('Project registration not found');
      }
      return { ok: true, project: toRegisteredProject(record) };
    });
  } catch (error) {
    logLifecycleFailure('rename', projectPath, 'write-metadata', error);
    return { ok: false, error: 'operation-failed' };
  }
}

export async function deleteProject(
  projectPathInput: string,
  trashItem: TrashItem,
): Promise<ProjectLifecycleResult> {
  const projectPath = path.resolve(projectPathInput);
  try {
    assertSafePath(projectPath);
  } catch (error) {
    logLifecycleFailure('delete', projectPath, 'path-guard', error);
    return { ok: false, error: 'operation-failed' };
  }

  if (isProtectedProjectPath(projectPath)) {
    return { ok: false, error: 'protected-path' };
  }
  let existing: ProjectRecord | undefined;
  try {
    existing = getProject(projectPath);
  } catch (error) {
    logLifecycleFailure('delete', projectPath, 'read-registration', error);
    return { ok: false, error: 'operation-failed' };
  }
  if (!existing || existing.deletedAt) return { ok: false, error: 'not-found' };
  const registration = existing;

  try {
    return await withProjectLock(projectPath, async () => {
      if (await isDirectory(projectPath)) {
        const document = await loadVerifiedProjectDocument(projectPath, registration);
        if (!document) {
          return { ok: false, error: 'not-found' };
        }
        await trashItem(projectPath);
      }
      revokePath(projectPath);
      if (!archiveProject(projectPath)) throw new Error('Project registration archive failed');
      return { ok: true };
    });
  } catch (error) {
    logLifecycleFailure('delete', projectPath, 'trash-or-archive', error);
    return { ok: false, error: 'operation-failed' };
  }
}

function normalizeProjectName(value: string): string | null {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 120) return null;
  if (name === '.' || name === '..' || name.endsWith('.') || INVALID_PROJECT_NAME.test(name)) return null;
  if ([...name].some((character) => character.charCodeAt(0) < 32)) return null;
  if (WINDOWS_DEVICE_NAME.test(name)) return null;
  return name;
}

async function shouldCopyPath(projectPath: string, source: string): Promise<boolean> {
  const relative = path.relative(projectPath, source).split(path.sep).join('/').toLowerCase();
  if (COPY_EXCLUDED_PATHS.some((excluded) => relative === excluded || relative.startsWith(`${excluded}/`))) {
    return false;
  }
  try {
    return !(await lstat(source)).isSymbolicLink();
  } catch {
    return false;
  }
}

function remapProjectFile(value: string | undefined, sourcePath: string, targetPath: string): string | undefined {
  if (!value || !path.isAbsolute(value) || !isSafePath(sourcePath, value)) return value;
  return path.join(targetPath, path.relative(sourcePath, value));
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function isProtectedProjectPath(projectPath: string): boolean {
  const resolved = path.resolve(projectPath);
  const orisonSpaceRoot = path.resolve(getOrisonSpaceRoot());
  return resolved === path.parse(resolved).root || isSafePath(resolved, orisonSpaceRoot);
}

function toRegisteredProject(record: ProjectRecord): RegisteredProject {
  return {
    projectId: record.projectId,
    name: record.name,
    type: record.type,
    path: record.path ?? record.localFingerprint,
    coverImage: record.coverImage,
    lastOpenedAt: record.lastOpenedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function logLifecycleFailure(
  action: 'duplicate' | 'rename' | 'delete',
  projectPath: string,
  phase: string,
  error: unknown,
  details: Record<string, unknown> = {},
): void {
  getLogger().warn({ action, projectPath, phase, ...details, err: error }, 'project lifecycle failed');
}
