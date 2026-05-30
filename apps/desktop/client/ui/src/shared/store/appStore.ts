import { create } from 'zustand';
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
import { createBackgroundTasksSlice, type BackgroundTasksSlice } from './backgroundTasksSlice';
import { createUpdateSlice, type UpdateSlice } from './updateSlice';
import { createCommandPaletteSlice, type CommandPaletteSlice } from './commandPaletteSlice';
import { createAgentSessionSlice, type AgentSessionSlice } from './agentSessionSlice';
import { createAgentSkillSlice, type AgentSkillSlice } from './agentSkillSlice';
import { createAgentDiffSlice, type AgentDiffSlice } from './agentDiffSlice';
import { createNotificationSlice, type NotificationSlice } from './notificationSlice';
import { installProjectSubscription } from './projectSubscription';

export type { WorkspaceModule, WorkspacePanel, ActivePage, SidebarPanel, BottomPanelTab, ThemeSetting, LocaleSetting, ProjectMeta, TaskAdapter, AgentMode } from './types';

export type AgentSlice = AgentSessionSlice & AgentSkillSlice & AgentDiffSlice;

type AppState = ProjectSlice &
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
  OrchestrationSlice &
  BackgroundTasksSlice &
  UpdateSlice &
  CommandPaletteSlice &
  AgentSessionSlice &
  AgentSkillSlice &
  AgentDiffSlice &
  NotificationSlice;

export const useAppStore = create<AppState>()((...a) => ({
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
  ...createBackgroundTasksSlice(...a),
  ...createUpdateSlice(...a),
  ...createCommandPaletteSlice(...a),
  ...createAgentSessionSlice(...a),
  ...createAgentSkillSlice(...a),
  ...createAgentDiffSlice(...a),
  ...createNotificationSlice(...a),
}));

installProjectSubscription(useAppStore);
