import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

let db: Database.Database;

function getDbPath(): string {
  const dataDir = path.join(app.getPath('home'), '.orison', 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, 'projects.db');
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

// 关闭并释放 SQLite 句柄。WAL 模式下句柄不关，Windows 无法删除底层文件
// （进程持有文件锁），测试清理与应用退出都依赖此方法显式释放。
export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined as unknown as Database.Database;
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      project_id        TEXT PRIMARY KEY,
      project_name      TEXT NOT NULL,
      project_type      TEXT NOT NULL CHECK(project_type IN ('novel','script')),
      local_fingerprint TEXT NOT NULL UNIQUE,
      project_path      TEXT,
      cover_image       TEXT,
      last_opened_at    TEXT,
      logline           TEXT,
      genre             TEXT,
      writing_style     TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      task_id         TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(project_id),
      target_id       TEXT,
      task_type       TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT NOT NULL,
      input_text      TEXT NOT NULL,
      status          TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
      output_type     TEXT,
      output_payload  TEXT,
      result_summary  TEXT,
      rationale       TEXT NOT NULL DEFAULT '',
      review_hint     TEXT NOT NULL DEFAULT '',
      retryable       INTEGER NOT NULL DEFAULT 1,
      error_message   TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      started_at      TEXT,
      finished_at     TEXT,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_asset_refs (
      task_id  TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL,
      PRIMARY KEY (task_id, asset_id)
    );

    CREATE TABLE IF NOT EXISTS project_assets (
      asset_id       TEXT NOT NULL,
      project_id     TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
      asset_type     TEXT NOT NULL,
      asset_name     TEXT NOT NULL,
      asset_group    TEXT NOT NULL DEFAULT '',
      asset_status   TEXT NOT NULL,
      relative_path  TEXT NOT NULL DEFAULT '',
      source_task_id TEXT,
      summary        TEXT,
      version        INTEGER NOT NULL DEFAULT 1,
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, asset_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project_created
      ON tasks (project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_status
      ON tasks (project_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_task_asset_refs_asset
      ON task_asset_refs (asset_id);
    CREATE INDEX IF NOT EXISTS idx_project_assets_type
      ON project_assets (project_id, asset_type, updated_at DESC);
  `);

  // Migration: add columns if missing (non-destructive)
  const cols = db.pragma('table_info(projects)') as { name: string }[];
  const colNames = new Set(cols.map(c => c.name));
  if (!colNames.has('logline')) db.exec('ALTER TABLE projects ADD COLUMN logline TEXT');
  if (!colNames.has('genre')) db.exec('ALTER TABLE projects ADD COLUMN genre TEXT');
  if (!colNames.has('writing_style')) db.exec('ALTER TABLE projects ADD COLUMN writing_style TEXT');
  // Registry columns: durable project list surviving app version changes.
  if (!colNames.has('project_path')) db.exec('ALTER TABLE projects ADD COLUMN project_path TEXT');
  if (!colNames.has('cover_image')) db.exec('ALTER TABLE projects ADD COLUMN cover_image TEXT');
  if (!colNames.has('last_opened_at')) db.exec('ALTER TABLE projects ADD COLUMN last_opened_at TEXT');
  // Backfill project_path from the fingerprint for rows registered before this column existed.
  if (!colNames.has('project_path')) {
    db.exec('UPDATE projects SET project_path = local_fingerprint WHERE project_path IS NULL');
  }

  // Migration: project_assets new columns
  const assetCols = db.pragma('table_info(project_assets)') as { name: string }[];
  const assetColNames = new Set(assetCols.map(c => c.name));
  if (!assetColNames.has('asset_group')) db.exec("ALTER TABLE project_assets ADD COLUMN asset_group TEXT NOT NULL DEFAULT ''");
  if (!assetColNames.has('relative_path')) db.exec("ALTER TABLE project_assets ADD COLUMN relative_path TEXT NOT NULL DEFAULT ''");
}
