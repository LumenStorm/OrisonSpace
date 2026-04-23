import type { z } from 'zod';
import { taskRequestSchema, taskResultSchema } from '@orison/shared-contracts';

type TaskRequest = z.infer<typeof taskRequestSchema>;
type TaskResult = z.infer<typeof taskResultSchema>;

export async function runMockTask(request: TaskRequest): Promise<TaskResult> {
  await new Promise((resolve) => setTimeout(resolve, 10));

  return taskResultSchema.parse({
    taskId: request.taskId,
    status: 'completed',
    outputType: 'patch',
    outputPayload: {
      operations: [
        {
          op: 'replace',
          path: 'outline.acts[0].summary',
          value: `Rewritten: ${request.userInstruction}`
        }
      ]
    },
    summary: 'Mock rewrite completed.',
    rationale: 'The mock adapter echoes the requested direction into a patch result.',
    reviewHint: 'Confirm that the returned patch targets the intended act.',
    retryable: true
  });
}
