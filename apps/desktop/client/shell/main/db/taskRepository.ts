import { getDb } from './index';

export type TaskRecord = {
  taskId: string;
  projectId: string;
  taskType: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  outputPayload?: string; // JSON
  createdAt: string;
  updatedAt: string;
};

export function listTasks(projectId: string, limit = 50): TaskRecord[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT task_id, project_id, task_type, name, status, error_message, output_payload, created_at, updated_at FROM tasks WHERE project_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(projectId, limit) as any[];
  return rows.map(toRecord);
}

export function upsertTask(input: {
  taskId: string;
  projectId: string;
  taskType: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  outputPayload?: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO tasks (task_id, project_id, task_type, name, description, input_text, status, error_message, output_payload, updated_at)
    VALUES (?, ?, ?, ?, '', '', ?, ?, ?, datetime('now'))
    ON CONFLICT(task_id) DO UPDATE SET
      status = excluded.status,
      error_message = excluded.error_message,
      output_payload = excluded.output_payload,
      updated_at = datetime('now')
  `).run(
    input.taskId,
    input.projectId,
    input.taskType,
    input.name,
    input.status,
    input.errorMessage ?? null,
    input.outputPayload ?? null,
  );
}

export function updateTaskStatus(taskId: string, status: string, errorMessage?: string): void {
  const db = getDb();
  db.prepare(
    'UPDATE tasks SET status = ?, error_message = ?, updated_at = datetime(\'now\') WHERE task_id = ?'
  ).run(status, errorMessage ?? null, taskId);
}

export function deleteTask(taskId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE task_id = ?').run(taskId);
}

function toRecord(row: any): TaskRecord {
  return {
    taskId: row.task_id,
    projectId: row.project_id,
    taskType: row.task_type,
    name: row.name,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    outputPayload: row.output_payload ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
