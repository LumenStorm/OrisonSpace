import type { z } from 'zod';
import { taskRequestSchema, taskResultSchema } from '@orison/shared-contracts';
import { pool } from '../../../common/db';
import type {
  PaginatedResult,
  ProjectAssetListItem,
  ProjectAssetListOptions,
  TaskAssetRefRecord,
  TaskListItem,
  TaskListOptions,
  TaskReadRepository,
  TaskResultRecord
} from './taskReadRepository';
import type { TaskCreateInput, TaskWriteRepository } from './taskWriteRepository';

type TaskResult = z.infer<typeof taskResultSchema>;
type TaskRequest = z.infer<typeof taskRequestSchema>;

function mapTaskRowToResult(row: Record<string, unknown>): TaskResultRecord {
  return taskResultSchema.parse({
    taskId: String(row.task_id),
    status: row.status,
    outputType: row.output_type ?? undefined,
    outputPayload: row.output_payload ?? undefined,
    summary: row.result_summary ?? '',
    rationale: row.rationale ?? '',
    reviewHint: row.review_hint ?? '',
    retryable: row.retryable ?? true
  });
}

function mapTaskListRow(row: Record<string, unknown>): TaskListItem {
  return {
    taskId: String(row.task_id),
    projectId: String(row.project_id),
    targetId: row.target_id ? String(row.target_id) : undefined,
    type: String(row.task_type),
    name: String(row.name),
    description: String(row.description),
    status: row.status as TaskListItem['status'],
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapProjectAssetRow(row: Record<string, unknown>): ProjectAssetListItem {
  return {
    assetId: String(row.asset_id),
    projectId: String(row.project_id),
    assetType: String(row.asset_type),
    assetName: String(row.asset_name),
    assetStatus: String(row.asset_status),
    sourceTaskId: row.source_task_id ? String(row.source_task_id) : undefined,
    summary: row.summary ? String(row.summary) : undefined,
    version: Number(row.version),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

import { decodeCursor, paginateRows } from './pagination';

class PostgresTaskRepository implements TaskReadRepository, TaskWriteRepository {
  async createTask(input: TaskCreateInput): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO tasks (
          task_id, project_id, target_id, task_type, name, description, input_text,
          status, output_type, output_payload, result_summary, rationale, review_hint, retryable
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
        )`,
        [
          input.taskId,
          input.request.projectId,
          input.request.targetId ?? null,
          input.request.type,
          input.request.name,
          input.request.description,
          input.request.input,
          input.result.status,
          input.result.outputType ?? null,
          input.result.outputPayload ?? null,
          input.result.summary,
          input.result.rationale,
          input.result.reviewHint,
          input.result.retryable
        ]
      );

      if (input.request.assetIds.length > 0) {
        const values: string[] = [];
        const params: unknown[] = [];

        input.request.assetIds.forEach((assetId, index) => {
          const offset = index * 2;
          values.push(`($${offset + 1}, $${offset + 2})`);
          params.push(input.taskId, assetId);
        });

        await client.query(
          `INSERT INTO task_asset_refs (task_id, asset_id) VALUES ${values.join(', ')}`,
          params
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateTask(taskId: string, result: TaskResult): Promise<void> {
    const isTerminal = result.status === 'completed' || result.status === 'failed';
    const startedAtClause = result.status === 'running' ? ', started_at = COALESCE(started_at, NOW())' : '';
    const finishedAtClause = isTerminal ? ', finished_at = NOW()' : '';

    await pool.query(
      `UPDATE tasks
       SET status = $2,
           output_type = $3,
           output_payload = $4,
           result_summary = $5,
           rationale = $6,
           review_hint = $7,
           retryable = $8,
           error_message = $9,
           updated_at = NOW()
           ${startedAtClause}
           ${finishedAtClause}
       WHERE task_id = $1`,
      [
        taskId,
        result.status,
        result.outputType ?? null,
        result.outputPayload ?? null,
        result.summary,
        result.rationale,
        result.reviewHint,
        result.retryable,
        result.status === 'failed' ? result.summary : null
      ]
    );
  }

  async getTaskResult(taskId: string): Promise<TaskResultRecord | null> {
    const result = await pool.query(
      `SELECT task_id, status, output_type, output_payload, result_summary, rationale, review_hint, retryable
       FROM tasks
       WHERE task_id = $1`,
      [taskId]
    );

    return result.rowCount ? mapTaskRowToResult(result.rows[0]) : null;
  }

  async getTaskMeta(taskId: string): Promise<TaskListItem | null> {
    const result = await pool.query(
      `SELECT task_id, project_id, target_id, task_type, name, description, status, created_at
       FROM tasks
       WHERE task_id = $1`,
      [taskId]
    );

    return result.rowCount ? mapTaskListRow(result.rows[0]) : null;
  }

  async listByProject(projectId: string, options: TaskListOptions): Promise<PaginatedResult<TaskListItem>> {
    const cursor = decodeCursor(options.cursor);
    const isDesc = options.sort === 'createdDesc';
    const comparator = isDesc ? '<' : '>';
    const order = isDesc ? 'DESC' : 'ASC';
    const cursorClause = cursor ? `AND (created_at, task_id) ${comparator} ($2::timestamptz, $3::varchar)` : '';
    const params = cursor ? [projectId, cursor.ts, cursor.id, options.limit + 1] : [projectId, options.limit + 1];
    const limitParam = cursor ? '$4' : '$2';

    const result = await pool.query(
      `SELECT task_id, project_id, target_id, task_type, name, description, status, created_at
       FROM tasks
       WHERE project_id = $1
       ${cursorClause}
       ORDER BY created_at ${order}, task_id ${order}
       LIMIT ${limitParam}`,
      params
    );

    return paginateRows(result.rows, options.limit, mapTaskListRow, (row) => ({
      ts: new Date(String(row.created_at)).toISOString(),
      id: String(row.task_id)
    }));
  }

  async listAssetRefsForTaskIds(taskIds: string[]): Promise<TaskAssetRefRecord[]> {
    if (taskIds.length === 0) return [];

    const result = await pool.query(
      `SELECT task_id, asset_id
       FROM task_asset_refs
       WHERE task_id = ANY($1::varchar[])`,
      [taskIds]
    );

    return result.rows.map((row) => ({
      taskId: String(row.task_id),
      assetId: String(row.asset_id)
    }));
  }

  async listProjectAssets(projectId: string, options: ProjectAssetListOptions): Promise<PaginatedResult<ProjectAssetListItem>> {
    const cursor = decodeCursor(options.cursor);
    const isDesc = options.sort === 'updatedDesc';
    const comparator = isDesc ? '<' : '>';
    const order = isDesc ? 'DESC' : 'ASC';
    const cursorClause = cursor ? `AND (updated_at, asset_id) ${comparator} ($2::timestamptz, $3::varchar)` : '';
    const params = cursor ? [projectId, cursor.ts, cursor.id, options.limit + 1] : [projectId, options.limit + 1];
    const limitParam = cursor ? '$4' : '$2';

    const result = await pool.query(
      `SELECT asset_id, project_id, asset_type, asset_name, asset_status, source_task_id, summary, version, updated_at
       FROM project_assets
       WHERE project_id = $1
       ${cursorClause}
       ORDER BY updated_at ${order}, asset_id ${order}
       LIMIT ${limitParam}`,
      params
    );

    return paginateRows(result.rows, options.limit, mapProjectAssetRow, (row) => ({
      ts: new Date(String(row.updated_at)).toISOString(),
      id: String(row.asset_id)
    }));
  }

  async upsertProjectAssets(taskId: string, request: TaskRequest): Promise<void> {
    if (request.assetIds.length === 0) return;

    const values: string[] = [];
    const params: unknown[] = [];

    request.assetIds.forEach((assetId, index) => {
      const offset = index * 7;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
      params.push(
        assetId,
        request.projectId,
        'unknown',
        assetId,
        'active',
        taskId,
        request.description
      );
    });

    await pool.query(
       `INSERT INTO project_assets (
         asset_id, project_id, asset_type, asset_name, asset_status, source_task_id, summary
       ) VALUES ${values.join(', ')}
       ON CONFLICT (project_id, asset_id) DO UPDATE
       SET asset_type = EXCLUDED.asset_type,
           asset_name = EXCLUDED.asset_name,
           asset_status = EXCLUDED.asset_status,
           source_task_id = EXCLUDED.source_task_id,
           summary = EXCLUDED.summary,
           version = project_assets.version + 1,
           updated_at = NOW()`,
      params
    );
  }
}

export const postgresTaskRepository = new PostgresTaskRepository();
