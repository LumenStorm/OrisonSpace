import path from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Point the SQLite registry at a throwaway home so the real ~/.orison db is
// never touched. The db module derives its path from app.getPath('home').
const TEST_HOME = path.join(process.cwd(), 'test-tmp-project-repo');

vi.mock('electron', () => ({
  app: { getPath: (_: string) => TEST_HOME },
}));

import { archiveProject, completeProjectIdentityBackfill, ensureProject, getProject, getProjectById, listProjects, purgeProject, renameProject, touchProject } from '../main/db/projectRepository';
import { closeDb, getDb } from '../main/db/index';

// better-sqlite3 is a native addon rebuilt against Electron's ABI for the app;
// under plain-Node vitest its ABI may not match. Probe once and skip the SQL
// integration suite when it can't load, instead of failing the whole run.
let sqliteUsable = true;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  new Database(':memory:').close();
} catch {
  sqliteUsable = false;
}

function clean() {
  // 先关闭 SQLite 句柄再删目录：Windows 不允许删除被进程锁定的打开文件。
  closeDb();
  if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true, force: true });
}

describe.skipIf(!sqliteUsable)('projectRepository registry', () => {
  beforeAll(clean);
  afterAll(clean);

  it('migrates the legacy schema and marks existing projects for one-time identity backfill', () => {
    const dataDir = path.join(TEST_HOME, '.orison', 'data');
    const dbPath = path.join(dataDir, 'projects.db');
    mkdirSync(dataDir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE projects (
        project_id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        project_type TEXT NOT NULL,
        local_fingerprint TEXT NOT NULL UNIQUE,
        logline TEXT,
        genre TEXT,
        writing_style TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        project_path TEXT,
        cover_image TEXT,
        last_opened_at TEXT
      );
      INSERT INTO projects (
        project_id, project_name, project_type, local_fingerprint,
        created_at, updated_at, project_path
      ) VALUES (
        '00001', 'Legacy', 'novel', '/p/legacy',
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '/p/legacy'
      );
    `);
    legacyDb.close();

    const columns = getDb().pragma('table_info(projects)') as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      'deleted_at',
      'identity_backfill_pending',
    ]));

    const legacy = getProject('/p/legacy');
    expect(legacy?.projectId).toBe('00001');
    expect(legacy?.identityBackfillPending).toBe(true);
    expect(completeProjectIdentityBackfill('/p/legacy', '00001')).toBe(true);
    expect(getProject('/p/legacy')?.identityBackfillPending).toBe(false);

    clean();
  });

  it('registers a project and lists it back', () => {
    const rec = ensureProject({ name: 'Alpha', type: 'novel', localFingerprint: '/p/alpha', coverImage: 'cover.png' });
    expect(rec.projectId).toMatch(/^\d{5}$/);
    expect(rec.path).toBe('/p/alpha');

    const list = listProjects();
    const found = list.find((r) => r.localFingerprint === '/p/alpha');
    expect(found).toBeTruthy();
    expect(found?.name).toBe('Alpha');
    expect(found?.coverImage).toBe('cover.png');
  });

  it('is idempotent on re-registration and refreshes cover/path', () => {
    const first = ensureProject({ name: 'Beta', type: 'script', localFingerprint: '/p/beta' });
    const second = ensureProject({ projectId: first.projectId, name: 'Beta', type: 'script', localFingerprint: '/p/beta', coverImage: 'b.png' });
    expect(second.projectId).toBe(first.projectId);
    expect(second.coverImage).toBe('b.png');

    const count = listProjects().filter((r) => r.localFingerprint === '/p/beta').length;
    expect(count).toBe(1);
  });

  it('orders most-recently-touched first', async () => {
    ensureProject({ name: 'One', type: 'novel', localFingerprint: '/p/one' });
    ensureProject({ name: 'Two', type: 'novel', localFingerprint: '/p/two' });
    // Touch /p/one so it sorts ahead of /p/two.
    await new Promise((r) => setTimeout(r, 10));
    touchProject({ localFingerprint: '/p/one' });

    const fingerprints = listProjects().map((r) => r.localFingerprint);
    expect(fingerprints.indexOf('/p/one')).toBeLessThan(fingerprints.indexOf('/p/two'));
  });

  it('touchProject is a no-op for an unknown fingerprint', () => {
    expect(() => touchProject({ localFingerprint: '/p/does-not-exist' })).not.toThrow();
  });

  it('renames project metadata without changing its path identity', () => {
    const original = ensureProject({ name: 'Before', type: 'novel', localFingerprint: '/p/rename' });
    const renamed = renameProject('/p/rename', 'After');

    expect(renamed?.projectId).toBe(original.projectId);
    expect(renamed?.name).toBe('After');
    expect(renamed?.localFingerprint).toBe('/p/rename');
  });

  it('archives deleted projects and only revives them when the persistent id matches', () => {
    const archived = ensureProject({ name: 'Archived', type: 'script', localFingerprint: '/p/archived' });
    expect(archiveProject('/p/archived')).toBe(true);
    expect(listProjects().some((project) => project.projectId === archived.projectId)).toBe(false);
    expect(getProject('/p/archived')?.deletedAt).toBeTruthy();

    const revived = ensureProject({ projectId: archived.projectId, name: 'Restored', type: 'script', localFingerprint: '/p/archived' });
    expect(revived.projectId).toBe(archived.projectId);
    expect(revived.name).toBe('Restored');
    expect(revived.deletedAt).toBeUndefined();
  });

  it('assigns a fresh id when a new project is created at an archived path', () => {
    const archived = ensureProject({ name: 'Old', type: 'novel', localFingerprint: '/p/reused-path' });
    expect(archiveProject('/p/reused-path')).toBe(true);

    const created = ensureProject({ name: 'New', type: 'novel', localFingerprint: '/p/reused-path' });
    expect(created.projectId).not.toBe(archived.projectId);
    expect(getProjectById(archived.projectId)?.deletedAt).toBeTruthy();
    expect(getProject('/p/reused-path')?.projectId).toBe(created.projectId);
  });

  it('archives an active identity when the same path is occupied by a different project', () => {
    const original = ensureProject({ name: 'Original', type: 'novel', localFingerprint: '/p/active-reused' });

    const replacement = ensureProject({ name: 'Replacement', type: 'script', localFingerprint: '/p/active-reused' });
    expect(replacement.projectId).not.toBe(original.projectId);
    expect(getProjectById(original.projectId)?.deletedAt).toBeTruthy();
    expect(getProject('/p/active-reused')?.projectId).toBe(replacement.projectId);
  });

  it('purges a failed-copy registration without referencing a missing table', () => {
    ensureProject({ name: 'Temporary Copy', type: 'novel', localFingerprint: '/p/temporary-copy' });

    expect(() => purgeProject('/p/temporary-copy')).not.toThrow();
    expect(getProject('/p/temporary-copy')).toBeUndefined();
  });
});
