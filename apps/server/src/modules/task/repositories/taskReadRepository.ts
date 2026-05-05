import type { z } from 'zod';
import type { taskResultSchema, taskListQuerySchema, projectAssetListQuerySchema } from '@orison/shared-contracts';
import type { PaginatedResult } from './pagination';

export type { PaginatedResult } from './pagination';

export type TaskResultRecord = z.infer<typeof taskResultSchema>;
export type TaskListOptions = z.infer<typeof taskListQuerySchema>;
export type ProjectAssetListOptions = z.infer<typeof projectAssetListQuerySchema>;

export type TaskListItem = {
  taskId: string;
  projectId: string;
  targetId?: string;
  type: string;
  name: string;
  description: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: string;
};

export type TaskAssetRefRecord = {
  taskId: string;
  assetId: string;
};

export type ProjectAssetListItem = {
  assetId: string;
  projectId: string;
  assetType: string;
  assetName: string;
  assetStatus: string;
  sourceTaskId?: string;
  summary?: string;
  version: number;
  updatedAt: string;
};

export interface TaskReadRepository {
  getTaskResult(taskId: string): Promise<TaskResultRecord | null>;
  getTaskMeta(taskId: string): Promise<TaskListItem | null>;
  listByProject(projectId: string, options: TaskListOptions): Promise<PaginatedResult<TaskListItem>>;
  listAssetRefsForTaskIds(taskIds: string[]): Promise<TaskAssetRefRecord[]>;
  listProjectAssets(projectId: string, options: ProjectAssetListOptions): Promise<PaginatedResult<ProjectAssetListItem>>;
}
