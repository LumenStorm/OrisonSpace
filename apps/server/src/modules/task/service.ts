import type { z } from 'zod';
import { taskRequestSchema, taskResultSchema } from '@orison/shared-contracts';
import { runMockTask } from './mockAdapter';
import { taskStore } from './store';

type TaskRequest = z.infer<typeof taskRequestSchema>;

export function enqueueTask(request: TaskRequest) {
  taskStore.save(
    request,
    taskResultSchema.parse({
      taskId: request.taskId,
      status: 'queued',
      summary: 'Task accepted.',
      rationale: 'Queued for mock execution.',
      reviewHint: 'Wait for the task to complete before reviewing.',
      retryable: true
    })
  );

  queueMicrotask(async () => {
    taskStore.update(
      request.taskId,
      taskResultSchema.parse({
        taskId: request.taskId,
        status: 'running',
        summary: 'Task is running.',
        rationale: 'The mock executor has started.',
        reviewHint: 'Wait for completion.',
        retryable: true
      })
    );

    const result = await runMockTask(request);
    taskStore.update(request.taskId, result);
  });
}
