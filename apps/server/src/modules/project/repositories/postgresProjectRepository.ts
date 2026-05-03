import type { PoolClient } from 'pg';
import { pool } from '../../../common/db';
import type { ProjectReadRepository, ProjectRecord } from './projectReadRepository';
import type { CreateProjectInput, ProjectWriteRepository } from './projectWriteRepository';

function mapProjectRow(row: Record<string, unknown>): ProjectRecord {
  return {
    projectId: String(row.project_id),
    name: String(row.project_name),
    type: row.project_type as 'novel' | 'script',
    localFingerprint: String(row.local_fingerprint),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

async function allocateNextProjectId(client: PoolClient) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [41001]);

  const result = await client.query<{ project_id: string }>(
    'SELECT project_id FROM projects ORDER BY project_id DESC LIMIT 1'
  );

  const current = result.rows[0]?.project_id ? Number(result.rows[0].project_id) : 0;
  return String(current + 1).padStart(5, '0');
}

class PostgresProjectRepository implements ProjectReadRepository, ProjectWriteRepository {
  async findByLocalFingerprint(localFingerprint: string): Promise<ProjectRecord | null> {
    const result = await pool.query(
      `SELECT project_id, project_name, project_type, local_fingerprint, created_at, updated_at
       FROM projects
       WHERE local_fingerprint = $1`,
      [localFingerprint]
    );

    return result.rowCount ? mapProjectRow(result.rows[0]) : null;
  }

  async existsById(projectId: string): Promise<boolean> {
    const result = await pool.query('SELECT 1 FROM projects WHERE project_id = $1', [projectId]);
    return result.rowCount !== 0;
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT project_id, project_name, project_type, local_fingerprint, created_at, updated_at
         FROM projects
         WHERE local_fingerprint = $1`,
        [input.localFingerprint]
      );

      if (existing.rowCount) {
        await client.query('COMMIT');
        return mapProjectRow(existing.rows[0]);
      }

      const projectId = await allocateNextProjectId(client);
      const inserted = await client.query(
        `INSERT INTO projects (project_id, project_name, project_type, local_fingerprint)
         VALUES ($1, $2, $3, $4)
         RETURNING project_id, project_name, project_type, local_fingerprint, created_at, updated_at`,
        [projectId, input.name, input.type, input.localFingerprint]
      );

      await client.query('COMMIT');
      return mapProjectRow(inserted.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const postgresProjectRepository = new PostgresProjectRepository();
