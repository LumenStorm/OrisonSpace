import type { z } from 'zod';
import type { taskRequestSchema, taskResultSchema, patchOperationSchema } from '@orison/shared-contracts';

export type WorkspaceModule = 'outline' | 'novel' | 'script';
export type WorkspacePanel = 'overview' | 'storyboard' | 'image_gen' | 'video' | 'assets';
export type ActivePage = 'overview' | 'outline' | 'novel' | 'script' | 'storyboard' | 'image_gen' | 'video' | 'assets';
export type SidebarPanel = 'explorer' | 'search' | 'timeline';
export type BottomPanelTab = 'output' | 'tasks';
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
  synopsis?: string;
  genre?: string;
  theme?: string;
  writingStyle?: string;
  tone?: string;
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

/* ── Cross-slice dependency interfaces ── */

/** Subset of EditorSlice consumed by AgentSlice */
export interface ChapterAccessor {
  activeChapterId: string | null;
  chapters: { id: string; title: string; content: string }[];
  updateChapter: (id: string, patch: Partial<{ title: string; content: string }>) => void;
}
