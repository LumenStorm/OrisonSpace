import type { z } from 'zod';
import { taskRequestSchema, taskResultSchema } from '@orison/shared-contracts';
import { runMockTask } from './mockAdapter';
import { postgresProjectRepository } from '../project/repositories/postgresProjectRepository';
import { postgresTaskRepository } from './repositories/postgresTaskRepository';
import { createTaskId } from './taskId';

type TaskRequest = z.infer<typeof taskRequestSchema>;

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`);
  }
}

export async function enqueueTask(request: TaskRequest) {
  const projectExists = await postgresProjectRepository.existsById(request.projectId);
  if (!projectExists) {
    throw new ProjectNotFoundError(request.projectId);
  }

  const taskId = createTaskId();
  const queuedResult = taskResultSchema.parse({
    taskId,
    status: 'queued',
    summary: 'Task accepted.',
    rationale: 'Queued for mock execution.',
    reviewHint: 'Wait for the task to complete before reviewing.',
    retryable: true
  });

  await postgresTaskRepository.createTask({
    taskId,
    request,
    result: queuedResult
  });

  queueMicrotask(async () => {
    await postgresTaskRepository.updateTask(
      taskId,
      taskResultSchema.parse({
        taskId,
        status: 'running',
        summary: 'Task is running.',
        rationale: 'The mock executor has started.',
        reviewHint: 'Wait for completion.',
        retryable: true
      })
    );

    const result = await runMockTask(taskId, request);
    await postgresTaskRepository.updateTask(taskId, result);
  });

  return queuedResult;
}

export async function listProjectTasks(projectId: string) {
  const projectExists = await postgresProjectRepository.existsById(projectId);
  if (!projectExists) {
    throw new ProjectNotFoundError(projectId);
  }

  const tasks = await postgresTaskRepository.listByProject(projectId);
  const refs = await postgresTaskRepository.listAssetRefsForTaskIds(tasks.map((task) => task.taskId));
  const grouped = new Map<string, string[]>();

  for (const ref of refs) {
    const current = grouped.get(ref.taskId) ?? [];
    current.push(ref.assetId);
    grouped.set(ref.taskId, current);
  }

  return {
    items: tasks.map((task) => ({
      ...task,
      assetIds: grouped.get(task.taskId) ?? []
    }))
  };
}

export async function listProjectAssets(projectId: string) {
  const projectExists = await postgresProjectRepository.existsById(projectId);
  if (!projectExists) {
    throw new ProjectNotFoundError(projectId);
  }

  return {
    items: await postgresTaskRepository.listProjectAssets(projectId)
  };
}
