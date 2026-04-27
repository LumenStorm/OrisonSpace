import pg from 'pg';
import { env } from './env';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function initDatabase(): Promise<void> {
  const url = new URL(env.DATABASE_URL);
  const dbName = url.pathname.slice(1);

  // Connect to default 'postgres' database to check/create target DB
  url.pathname = '/postgres';
  const adminPool = new pg.Pool({ connectionString: url.toString() });

  try {
    const { rows } = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await adminPool.end();
  }

  // Create tables in target DB
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name  VARCHAR(100),
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      project_id        VARCHAR(5) PRIMARY KEY,
      project_name      VARCHAR(255) NOT NULL,
      project_type      VARCHAR(32) NOT NULL,
      local_fingerprint VARCHAR(255) NOT NULL UNIQUE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      task_id         VARCHAR(32) PRIMARY KEY,
      project_id      VARCHAR(5) NOT NULL REFERENCES projects(project_id),
      target_id       VARCHAR(128),
      task_type       VARCHAR(64) NOT NULL,
      name            VARCHAR(255) NOT NULL,
      description     TEXT NOT NULL,
      input_text      TEXT NOT NULL,
      status          VARCHAR(32) NOT NULL,
      output_type     VARCHAR(32),
      output_payload  JSONB,
      result_summary  TEXT,
      rationale       TEXT NOT NULL DEFAULT '',
      review_hint     TEXT NOT NULL DEFAULT '',
      retryable       BOOLEAN NOT NULL DEFAULT TRUE,
      error_message   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at      TIMESTAMPTZ,
      finished_at     TIMESTAMPTZ,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_asset_refs (
      task_id    VARCHAR(32) NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
      asset_id   VARCHAR(128) NOT NULL,
      PRIMARY KEY (task_id, asset_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_created_at
    ON tasks (project_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_status_created_at
    ON tasks (project_id, status, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_target_created_at
    ON tasks (project_id, target_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_task_asset_refs_asset_id
    ON task_asset_refs (asset_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_assets (
      asset_id        VARCHAR(128) PRIMARY KEY,
      project_id      VARCHAR(5) NOT NULL REFERENCES projects(project_id),
      asset_type      VARCHAR(32) NOT NULL,
      asset_name      VARCHAR(255) NOT NULL,
      asset_status    VARCHAR(32) NOT NULL,
      source_task_id  VARCHAR(32),
      summary         TEXT,
      version         INTEGER NOT NULL DEFAULT 1,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_project_assets_project_type_updated
    ON project_assets (project_id, asset_type, updated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_project_assets_project_name
    ON project_assets (project_id, asset_name)
  `);
}
