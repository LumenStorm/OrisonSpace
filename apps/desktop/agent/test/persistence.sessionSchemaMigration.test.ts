import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let sqliteUsable = true;
try {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const Database = req('better-sqlite3');
  new Database(':memory:').close();
} catch {
  sqliteUsable = false;
}

describe.skipIf(!sqliteUsable)('session persistence schema migration', () => {
  let projectPath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-session-migration-'));
    mkdirSync(path.join(projectPath, '.orison', 'sessions'), { recursive: true });
  });

  afterEach(async () => {
    const { closeDb } = await import('../src/agent/persistence');
    closeDb(projectPath);
    rmSync(projectPath, { recursive: true, force: true });
    vi.resetModules();
  });

  it('upgrades an existing sessions index lacking session-tree columns', async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');

    const dbPath = path.join(projectPath, '.orison', 'sessions', 'index.db');
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        agent_name TEXT NOT NULL,
        project_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    db.close();

    const { createSession } = await import('../src/agent/session');
    const session = createSession({
      agentName: 'writer',
      projectPath,
      parentId: 'parent-session',
      children: [],
      sessionRole: 'child',
    });

    expect(session.parentId).toBe('parent-session');

    const verifyDb = new Database(dbPath, { readonly: true });
    const row = verifyDb.prepare(`
      SELECT parent_id as parentId, session_role as sessionRole, children_json as childrenJson
      FROM sessions
      WHERE id = ?
    `).get(session.id) as { parentId: string | null; sessionRole: string | null; childrenJson: string };
    verifyDb.close();

    expect(row.parentId).toBe('parent-session');
    expect(row.sessionRole).toBe('child');
    expect(row.childrenJson).toBe('[]');
  });
});
