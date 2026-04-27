import type { z } from 'zod';
import {
  taskRequestSchema,
  taskResultSchema,
  loginResponseSchema,
  DEFAULT_API_BASE
} from '@orison/shared-contracts';

type TaskRequest = z.infer<typeof taskRequestSchema>;
type TaskResult = z.infer<typeof taskResultSchema>;
type LoginResponse = z.infer<typeof loginResponseSchema>;

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

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function createClientApi(getToken: () => string | null) {
  return {
    login(email: string, password: string): Promise<LoginResponse> {
      return request(
        '/v1/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
        loginResponseSchema
      );
    },

    submitTask(payload: TaskRequest): Promise<{ taskId: string; status: string }> {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      return request(
        '/v1/tasks',
        {
          method: 'POST',
          body: JSON.stringify(taskRequestSchema.parse(payload)),
          headers: authHeaders(token)
        },
        taskResultSchema.pick({ taskId: true, status: true })
      );
    },

    getTaskResult(taskId: string): Promise<TaskResult> {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      return request(
        `/v1/tasks/${encodeURIComponent(taskId)}`,
        { method: 'GET', headers: authHeaders(token) },
        taskResultSchema
      );
    }
  };
}

export type ClientApi = ReturnType<typeof createClientApi>;
