import type { z } from 'zod';
import {
  projectAssetListQuerySchema,
  taskListQuerySchema,
  taskRequestSchema,
  taskResultSchema,
} from '@orison/shared-contracts';
import { runMockTask } from './mockAdapter';
import { postgresProjectRepository } from '../project/repositories/postgresProjectRepository';
import { postgresTaskRepository } from './repositories/postgresTaskRepository';
import { createTaskId } from './taskId';

type TaskRequest = z.infer<typeof taskRequestSchema>;
type TaskListQuery = z.infer<typeof taskListQuerySchema>;
type ProjectAssetListQuery = z.infer<typeof projectAssetListQuerySchema>;

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`);
  }
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} not found`);
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
    await postgresTaskRepository.upsertProjectAssets(taskId, request);
  });

  return queuedResult;
}

export async function listProjectTasks(projectId: string, options: TaskListQuery) {
  const projectExists = await postgresProjectRepository.existsById(projectId);
  if (!projectExists) {
    throw new ProjectNotFoundError(projectId);
  }

  const page = await postgresTaskRepository.listByProject(projectId, options);
  const refs = await postgresTaskRepository.listAssetRefsForTaskIds(page.items.map((task) => task.taskId));
  const grouped = new Map<string, string[]>();

  for (const ref of refs) {
    const current = grouped.get(ref.taskId) ?? [];
    current.push(ref.assetId);
    grouped.set(ref.taskId, current);
  }

  return {
    items: page.items.map((task) => ({
      ...task,
      assetIds: grouped.get(task.taskId) ?? []
    })),
    nextCursor: page.nextCursor
  };
}

export async function listProjectAssets(projectId: string, options: ProjectAssetListQuery) {
  const projectExists = await postgresProjectRepository.existsById(projectId);
  if (!projectExists) {
    throw new ProjectNotFoundError(projectId);
  }

  return postgresTaskRepository.listProjectAssets(projectId, options);
}

export async function getTaskResult(taskId: string) {
  return postgresTaskRepository.getTaskResult(taskId);
}

export async function getTaskDetail(taskId: string) {
  const meta = await postgresTaskRepository.getTaskMeta(taskId);
  if (!meta) {
    throw new TaskNotFoundError(taskId);
  }
  const result = await postgresTaskRepository.getTaskResult(taskId);
  const refs = await postgresTaskRepository.listAssetRefsForTaskIds([taskId]);
  return {
    task: {
      ...meta,
      assetIds: refs.filter((ref) => ref.taskId === taskId).map((ref) => ref.assetId)
    },
    result
  };
}
