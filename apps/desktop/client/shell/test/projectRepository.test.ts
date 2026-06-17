import path from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Point the SQLite registry at a throwaway home so the real ~/.orison db is
// never touched. The db module derives its path from app.getPath('home').
const TEST_HOME = path.join(process.cwd(), 'test-tmp-project-repo');

vi.mock('electron', () => ({
  app: { getPath: (_: string) => TEST_HOME },
}));

import { ensureProject, listProjects, touchProject } from '../main/db/projectRepository';
import { closeDb } from '../main/db/index';

// better-sqlite3 is a native addon rebuilt against Electron's ABI for the app;
// under plain-Node vitest its ABI may not match. Probe once and skip the SQL
// integration suite when it can't load, instead of failing the whole run.
let sqliteUsable = true;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
    const second = ensureProject({ name: 'Beta', type: 'script', localFingerprint: '/p/beta', coverImage: 'b.png' });
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
});
