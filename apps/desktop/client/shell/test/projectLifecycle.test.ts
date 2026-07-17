import path from 'node:path';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyProjectDocument,
  loadProject,
  saveProject,
} from '@orison/desktop-local-bff';

const repository = vi.hoisted(() => ({
  archiveProject: vi.fn(),
  completeProjectIdentityBackfill: vi.fn(),
  ensureProject: vi.fn(),
  getProject: vi.fn(),
  purgeProject: vi.fn(),
  renameProject: vi.fn(),
}));

vi.mock('../main/db/projectRepository', () => ({
  archiveProject: repository.archiveProject,
  completeProjectIdentityBackfill: repository.completeProjectIdentityBackfill,
  ensureProject: repository.ensureProject,
  getProject: repository.getProject,
  purgeProject: repository.purgeProject,
  renameProject: repository.renameProject,
}));

import { allowPath } from '../main/ipc/pathGuard';
import {
  deleteProject,
  duplicateProject,
  renameProject,
} from '../main/ipc/projectLifecycle';

const TEST_ROOT = path.join(process.cwd(), 'test-tmp-project-lifecycle');
const SOURCE_PATH = path.join(TEST_ROOT, 'Source');

function projectRecord(overrides: Record<string, unknown> = {}) {
  return {
    projectId: '00001',
    name: 'Source',
    type: 'novel' as const,
    localFingerprint: SOURCE_PATH,
    path: SOURCE_PATH,
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    identityBackfillPending: false,
    ...overrides,
  };
}

describe('project lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    allowPath(TEST_ROOT);
  });

  afterEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('duplicates project files, excludes runtime history, and writes a fresh identity', async () => {
    const coverPath = path.join(SOURCE_PATH, 'assets', 'cover.png');
    const sourceDocument = createEmptyProjectDocument('Source', 'novel') as any;
    sourceDocument.meta.id = 'source-document-id';
    sourceDocument.meta.project_id = '00001';
    sourceDocument.meta.version = 8;
    sourceDocument.meta.cover_image = coverPath;
    saveProject(SOURCE_PATH, sourceDocument);
    mkdirSync(path.dirname(coverPath), { recursive: true });
    writeFileSync(coverPath, 'cover', 'utf8');
    mkdirSync(path.join(SOURCE_PATH, 'chapters'), { recursive: true });
    writeFileSync(path.join(SOURCE_PATH, 'chapters', 'one.md'), '# One', 'utf8');
    for (const excluded of ['.git', '.orison/sessions', '.orison/artifacts', '.orison/history']) {
      const excludedDir = path.join(SOURCE_PATH, excluded);
      mkdirSync(excludedDir, { recursive: true });
      writeFileSync(path.join(excludedDir, 'ignored.txt'), 'ignore', 'utf8');
    }

    repository.getProject.mockImplementation((projectPath: string) => (
      projectPath === SOURCE_PATH ? projectRecord({ coverImage: coverPath }) : undefined
    ));
    repository.ensureProject.mockImplementation((input: any) => projectRecord({
      projectId: '00002',
      name: input.name,
      localFingerprint: input.localFingerprint,
      path: input.path,
      coverImage: input.coverImage,
    }));

    const result = await duplicateProject(SOURCE_PATH, 'Source Copy');
    const targetPath = path.join(TEST_ROOT, 'Source Copy');

    expect(result).toMatchObject({
      ok: true,
      project: {
        projectId: '00002',
        name: 'Source Copy',
        path: targetPath,
      },
    });
    expect(existsSync(path.join(targetPath, 'chapters', 'one.md'))).toBe(true);
    expect(existsSync(path.join(targetPath, '.git'))).toBe(false);
    expect(existsSync(path.join(targetPath, '.orison', 'sessions'))).toBe(false);
    expect(existsSync(path.join(targetPath, '.orison', 'artifacts'))).toBe(false);
    expect(existsSync(path.join(targetPath, '.orison', 'history'))).toBe(false);

    const copiedDocument = loadProject(targetPath)!;
    expect(copiedDocument.meta.id).not.toBe('source-document-id');
    expect(copiedDocument.meta.project_id).toBe('00002');
    expect(copiedDocument.meta.name).toBe('Source Copy');
    expect(copiedDocument.meta.version).toBe(0);
    expect(copiedDocument.meta.cover_image).toBe(path.join(targetPath, 'assets', 'cover.png'));
    expect(repository.ensureProject).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Source Copy',
      localFingerprint: targetPath,
      path: targetPath,
      coverImage: path.join(targetPath, 'assets', 'cover.png'),
    }));
  });

  it('backfills a legacy project id once before duplicating', async () => {
    const sourceDocument = createEmptyProjectDocument('Legacy Source', 'novel') as any;
    sourceDocument.meta.version = 2;
    saveProject(SOURCE_PATH, sourceDocument);
    repository.getProject.mockImplementation((projectPath: string) => (
      projectPath === SOURCE_PATH
        ? projectRecord({ name: 'Legacy Source', identityBackfillPending: true })
        : undefined
    ));
    repository.ensureProject.mockImplementation((input: any) => projectRecord({
      projectId: '00002',
      name: input.name,
      localFingerprint: input.localFingerprint,
      path: input.path,
    }));
    repository.completeProjectIdentityBackfill.mockReturnValue(true);

    await expect(duplicateProject(SOURCE_PATH, 'Legacy Copy')).resolves.toMatchObject({
      ok: true,
      project: { projectId: '00002', name: 'Legacy Copy' },
    });

    expect(loadProject(SOURCE_PATH)?.meta).toMatchObject({
      project_id: '00001',
      version: 3,
    });
    expect(repository.completeProjectIdentityBackfill).toHaveBeenCalledWith(SOURCE_PATH, '00001');
    expect(loadProject(path.join(TEST_ROOT, 'Legacy Copy'))?.meta.project_id).toBe('00002');
  });

  it('does not backfill an unmarked project whose disk identity is missing', async () => {
    saveProject(SOURCE_PATH, createEmptyProjectDocument('Replacement', 'novel'));
    repository.getProject.mockImplementation((projectPath: string) => (
      projectPath === SOURCE_PATH ? projectRecord() : undefined
    ));

    await expect(duplicateProject(SOURCE_PATH, 'Unsafe Copy')).resolves.toEqual({
      ok: false,
      error: 'not-found',
    });
    expect(repository.completeProjectIdentityBackfill).not.toHaveBeenCalled();
    expect(existsSync(path.join(TEST_ROOT, 'Unsafe Copy'))).toBe(false);
  });

  it('rejects invalid or existing duplicate names before copying', async () => {
    mkdirSync(SOURCE_PATH, { recursive: true });
    repository.getProject.mockImplementation((projectPath: string) => (
      projectPath === SOURCE_PATH ? projectRecord() : undefined
    ));

    await expect(duplicateProject(SOURCE_PATH, 'CON')).resolves.toEqual({
      ok: false,
      error: 'invalid-name',
    });

    mkdirSync(path.join(TEST_ROOT, 'Existing'), { recursive: true });
    await expect(duplicateProject(SOURCE_PATH, 'Existing')).resolves.toEqual({
      ok: false,
      error: 'name-exists',
    });
    expect(repository.ensureProject).not.toHaveBeenCalled();
  });

  it('renames both project.yaml metadata and the registry without moving the directory', async () => {
    const sourceDocument = createEmptyProjectDocument('Source', 'script') as any;
    sourceDocument.meta.project_id = '00001';
    sourceDocument.meta.version = 3;
    saveProject(SOURCE_PATH, sourceDocument);
    repository.getProject.mockReturnValue(projectRecord({ type: 'script' }));
    repository.renameProject.mockReturnValue(projectRecord({ name: 'Renamed', type: 'script' }));

    const result = await renameProject(SOURCE_PATH, 'Renamed');

    expect(result).toMatchObject({
      ok: true,
      project: { projectId: '00001', name: 'Renamed', path: SOURCE_PATH },
    });
    expect(repository.renameProject).toHaveBeenCalledWith(SOURCE_PATH, 'Renamed');
    expect(existsSync(SOURCE_PATH)).toBe(true);
    expect(loadProject(SOURCE_PATH)?.meta).toMatchObject({
      name: 'Renamed',
      project_id: '00001',
      version: 4,
    });
  });

  it('trashes the project before archiving its registry entry', async () => {
    const document = createEmptyProjectDocument('Source', 'novel') as any;
    document.meta.project_id = '00001';
    saveProject(SOURCE_PATH, document);
    repository.getProject.mockReturnValue(projectRecord());
    repository.archiveProject.mockReturnValue(true);
    const trashItem = vi.fn(async () => undefined);

    await expect(deleteProject(SOURCE_PATH, trashItem)).resolves.toEqual({ ok: true });

    expect(trashItem).toHaveBeenCalledWith(SOURCE_PATH);
    expect(repository.archiveProject).toHaveBeenCalledWith(SOURCE_PATH);
    expect(trashItem.mock.invocationCallOrder[0]).toBeLessThan(
      repository.archiveProject.mock.invocationCallOrder[0],
    );
  });

  it('does not archive the registry when moving the project to trash fails', async () => {
    const document = createEmptyProjectDocument('Source', 'novel') as any;
    document.meta.project_id = '00001';
    saveProject(SOURCE_PATH, document);
    repository.getProject.mockReturnValue(projectRecord());
    const trashItem = vi.fn(async () => {
      throw new Error('trash failed');
    });

    await expect(deleteProject(SOURCE_PATH, trashItem)).resolves.toEqual({
      ok: false,
      error: 'operation-failed',
    });
    expect(repository.archiveProject).not.toHaveBeenCalled();
  });

  it('rejects lifecycle actions when the disk identity no longer matches the registry', async () => {
    const replacementDocument = createEmptyProjectDocument('Replacement', 'novel') as any;
    replacementDocument.meta.project_id = '00999';
    saveProject(SOURCE_PATH, replacementDocument);
    repository.getProject.mockImplementation((projectPath: string) => (
      projectPath === SOURCE_PATH
        ? projectRecord({ identityBackfillPending: true })
        : undefined
    ));
    const trashItem = vi.fn(async () => undefined);

    await expect(duplicateProject(SOURCE_PATH, 'Unsafe Copy')).resolves.toEqual({ ok: false, error: 'not-found' });
    await expect(renameProject(SOURCE_PATH, 'Unsafe Rename')).resolves.toEqual({ ok: false, error: 'not-found' });
    await expect(deleteProject(SOURCE_PATH, trashItem)).resolves.toEqual({ ok: false, error: 'not-found' });

    expect(existsSync(path.join(TEST_ROOT, 'Unsafe Copy'))).toBe(false);
    expect(repository.renameProject).not.toHaveBeenCalled();
    expect(repository.archiveProject).not.toHaveBeenCalled();
    expect(repository.completeProjectIdentityBackfill).not.toHaveBeenCalled();
    expect(trashItem).not.toHaveBeenCalled();
    expect(loadProject(SOURCE_PATH)?.meta.project_id).toBe('00999');
  });
});
