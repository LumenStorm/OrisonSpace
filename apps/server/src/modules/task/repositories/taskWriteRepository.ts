import type { z } from 'zod';
import type { taskRequestSchema, taskResultSchema } from '@orison/shared-contracts';

export type TaskCreateInput = {
  taskId: string;
  request: z.infer<typeof taskRequestSchema>;
  result: z.infer<typeof taskResultSchema>;
};

export interface TaskWriteRepository {
  createTask(input: TaskCreateInput): Promise<void>;
  updateTask(taskId: string, result: z.infer<typeof taskResultSchema>): Promise<void>;
}
