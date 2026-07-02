import { create } from 'zustand';
import { createProjectSlice, type ProjectSlice } from './projectSlice';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice';
import { createPanelsSlice, type PanelsSlice } from './panelsSlice';
import { createTasksSlice, type TasksSlice } from './tasksSlice';
import { createCreativeFieldsSlice, type CreativeFieldsSlice } from './creativeFieldsSlice';
import { createFileTabsSlice, type FileTabsSlice } from './fileTabsSlice';
import { createNovelChapterSlice, type NovelChapterSlice } from './novelChapterSlice';
import { createOutputSlice, type OutputSlice } from './outputSlice';
import { createRecentProjectsSlice, type RecentProjectsSlice } from './recentProjectsSlice';
import { createImageGenSlice, type ImageGenSlice } from './imageGenSlice';
import { createBackgroundTasksSlice, type BackgroundTasksSlice } from './backgroundTasksSlice';
import { createUpdateSlice, type UpdateSlice } from './updateSlice';
import { createCommandPaletteSlice, type CommandPaletteSlice } from './commandPaletteSlice';
import { createAgentSessionSlice, type AgentSessionSlice } from './agentSessionSlice';
import { createAgentSkillSlice, type AgentSkillSlice } from './agentSkillSlice';
import { createAgentDiffSlice, type AgentDiffSlice } from './agentDiffSlice';
import { createNotificationSlice, type NotificationSlice } from './notificationSlice';
import { createAgentSettingsSlice, type AgentSettingsSlice } from './agentSettingsSlice';
import { createAutoSaveSlice, type AutoSaveSlice } from './autoSaveSlice';
import { installProjectSubscription } from './projectSubscription';

export type { WorkspaceModule, WorkspacePanel, ActivePage, SidebarPanel, BottomPanelTab, ThemeSetting, LocaleSetting, ProjectMeta, TaskAdapter, AgentMode } from './types';
export type { MainView } from './panelsSlice';

type AppState = ProjectSlice &
  SettingsSlice &
  PanelsSlice &
  TasksSlice &
  CreativeFieldsSlice &
  FileTabsSlice &
  NovelChapterSlice &
  OutputSlice &
  RecentProjectsSlice &
  ImageGenSlice &
  BackgroundTasksSlice &
  UpdateSlice &
  CommandPaletteSlice &
  AgentSessionSlice &
  AgentSkillSlice &
  AgentDiffSlice &
  AgentSettingsSlice &
  AutoSaveSlice &
  NotificationSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createProjectSlice(...a),
  ...createSettingsSlice(...a),
  ...createPanelsSlice(...a),
  ...createTasksSlice(...a),
  ...createCreativeFieldsSlice(...a),
  ...createFileTabsSlice(...a),
  ...createNovelChapterSlice(...a),
  ...createOutputSlice(...a),
  ...createRecentProjectsSlice(...a),
  ...createImageGenSlice(...a),
  ...createBackgroundTasksSlice(...a),
  ...createUpdateSlice(...a),
  ...createCommandPaletteSlice(...a),
  ...createAgentSessionSlice(...a),
  ...createAgentSkillSlice(...a),
  ...createAgentDiffSlice(...a),
  ...createAgentSettingsSlice(...a),
  ...createAutoSaveSlice(...a),
  ...createNotificationSlice(...a),
}));

installProjectSubscription(useAppStore);
