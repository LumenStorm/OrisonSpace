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
}
