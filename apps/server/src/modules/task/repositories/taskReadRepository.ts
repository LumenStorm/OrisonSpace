import type { z } from 'zod';
import type { taskResultSchema } from '@orison/shared-contracts';

export type TaskResultRecord = z.infer<typeof taskResultSchema>;

export interface TaskReadRepository {
  getTaskResult(taskId: string): Promise<TaskResultRecord | null>;
}
