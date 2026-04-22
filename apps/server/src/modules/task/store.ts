import type { z } from 'zod';
import { taskRequestSchema, taskResultSchema } from '@orison/shared-contracts';

type TaskRequest = z.infer<typeof taskRequestSchema>;
type TaskResult = z.infer<typeof taskResultSchema>;

const store = new Map<string, { request: TaskRequest; result: TaskResult; createdAt: number }>();

export const taskStore = {
  save(request: TaskRequest, result: TaskResult) {
    store.set(request.taskId, {
      request,
      result,
      createdAt: Date.now()
    });
  },
  get(taskId: string) {
    return store.get(taskId);
  },
  update(taskId: string, result: TaskResult) {
    const current = store.get(taskId);
    if (!current) {
      return;
    }

    store.set(taskId, {
      ...current,
      result
    });
  }
};
