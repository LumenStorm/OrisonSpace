import type { z } from 'zod';
import type { taskResultSchema } from '@orison/shared-contracts';

export type TaskResultRecord = z.infer<typeof taskResultSchema>;

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
  listByProject(projectId: string): Promise<TaskListItem[]>;
  listAssetRefsForTaskIds(taskIds: string[]): Promise<TaskAssetRefRecord[]>;
  listProjectAssets(projectId: string): Promise<ProjectAssetListItem[]>;
}
