import type { z } from 'zod';
import {
  taskRequestSchema,
  taskResultSchema,
  DEFAULT_API_BASE
} from '@orison/shared-contracts';

type TaskRequest = z.infer<typeof taskRequestSchema>;
type TaskResult = z.infer<typeof taskResultSchema>;

const BASE_URL = DEFAULT_API_BASE;

async function request<T>(
  path: string,
  init: RequestInit,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API ${init.method ?? 'GET'} ${path} failed: ${response.status}`);
  }

  const body = await response.json();
  return schema.parse(body);
}

export function createClientApi() {
  return {
    submitTask(payload: TaskRequest): Promise<{ taskId: string; status: string }> {
      return request(
        '/v1/tasks',
        {
          method: 'POST',
          body: JSON.stringify(taskRequestSchema.parse(payload)),
        },
        taskResultSchema.pick({ taskId: true, status: true })
      );
    },

    getTaskResult(taskId: string): Promise<TaskResult> {
      return request(
        `/v1/tasks/${encodeURIComponent(taskId)}`,
        { method: 'GET' },
        taskResultSchema
      );
    }
  };
}

export type ClientApi = ReturnType<typeof createClientApi>;
