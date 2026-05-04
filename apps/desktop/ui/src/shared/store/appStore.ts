import { create } from 'zustand';
import { createAuthSlice, type AuthSlice } from './authSlice';
import { createProjectSlice, type ProjectSlice } from './projectSlice';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice';
import { createPanelsSlice, type PanelsSlice } from './panelsSlice';
import { createTasksSlice, type TasksSlice } from './tasksSlice';
import { createCreativeFieldsSlice, type CreativeFieldsSlice } from './creativeFieldsSlice';
import { createEditorSlice, type EditorSlice } from './editorSlice';
import { createFileTabsSlice, type FileTabsSlice } from './fileTabsSlice';
import { createNovelChapterSlice, type NovelChapterSlice } from './novelChapterSlice';
import { createOutputSlice, type OutputSlice } from './outputSlice';
import { createRecentProjectsSlice, type RecentProjectsSlice } from './recentProjectsSlice';
import { createImageGenSlice, type ImageGenSlice } from './imageGenSlice';
import { createOrchestrationSlice, type OrchestrationSlice } from './orchestrationSlice';

export type { WorkspaceModule, BottomPanelTab, ThemeSetting, LocaleSetting, ProjectMeta, UserInfo, TaskAdapter } from './types';

type AppState = AuthSlice &
  ProjectSlice &
  SettingsSlice &
  PanelsSlice &
  TasksSlice &
  CreativeFieldsSlice &
  EditorSlice &
  FileTabsSlice &
  NovelChapterSlice &
  OutputSlice &
  RecentProjectsSlice &
  ImageGenSlice &
  OrchestrationSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createProjectSlice(...a),
  ...createSettingsSlice(...a),
  ...createPanelsSlice(...a),
  ...createTasksSlice(...a),
  ...createCreativeFieldsSlice(...a),
  ...createEditorSlice(...a),
  ...createFileTabsSlice(...a),
  ...createNovelChapterSlice(...a),
  ...createOutputSlice(...a),
  ...createRecentProjectsSlice(...a),
  ...createImageGenSlice(...a),
  ...createOrchestrationSlice(...a),
}));
