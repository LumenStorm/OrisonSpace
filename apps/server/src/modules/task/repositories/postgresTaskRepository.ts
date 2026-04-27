import type { z } from 'zod';
import { taskResultSchema } from '@orison/shared-contracts';
import { pool } from '../../../common/db';
import type { TaskReadRepository, TaskResultRecord } from './taskReadRepository';
import type { TaskCreateInput, TaskWriteRepository } from './taskWriteRepository';

type TaskResult = z.infer<typeof taskResultSchema>;

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
          input.result.outputPayload ? JSON.stringify(input.result.outputPayload) : null,
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
        result.outputPayload ? JSON.stringify(result.outputPayload) : null,
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
}

export const postgresTaskRepository = new PostgresTaskRepository();
