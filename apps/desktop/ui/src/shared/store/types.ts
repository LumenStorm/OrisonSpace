import type { z } from 'zod';
import type { taskRequestSchema, taskResultSchema, patchOperationSchema } from '@orison/shared-contracts';

export type WorkspaceModule = 'overview' | 'outline' | 'novel' | 'script' | 'storyboard' | 'video' | 'image_gen';
export type SidebarPanel = 'explorer' | 'search';
export type BottomPanelTab = 'properties' | 'tasks' | 'output' | 'timeline';
export type ThemeSetting = 'system' | 'light' | 'dark' | (string & {});
export type LocaleSetting = 'system' | (string & {});
export type TaskRequest = z.infer<typeof taskRequestSchema>;
export type TaskResult = z.infer<typeof taskResultSchema>;
export type PatchOperation = z.infer<typeof patchOperationSchema>;

export type UserInfo = {
  id: string;
  email: string;
  displayName?: string;
};

export type ProjectMeta = {
  projectId?: string;
  name: string;
  path: string;
  type: 'novel' | 'script';
  logline?: string;
  genre?: string;
  writingStyle?: string;
  coverImage?: string;
};

export type TaskAdapter = {
  submitTask: (request: TaskRequest) => Promise<{ taskId: string; status: string }>;
  getTaskResult: (taskId: string) => Promise<TaskResult>;
};

export type TaskEntry = {
  request: TaskRequest;
  result: TaskResult | null;
};

export type AgentMode = 'auto' | 'suggest' | 'readonly';
