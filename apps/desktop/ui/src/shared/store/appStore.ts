import { create } from 'zustand';
import { createAuthSlice, type AuthSlice } from './authSlice';
import { createProjectSlice, type ProjectSlice } from './projectSlice';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice';
import { createPanelsSlice, type PanelsSlice } from './panelsSlice';
import { createTasksSlice, type TasksSlice } from './tasksSlice';

export type { WorkspaceModule, ThemeSetting, LocaleSetting, ProjectMeta, UserInfo } from './types';

type AppState = AuthSlice & ProjectSlice & SettingsSlice & PanelsSlice & TasksSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createProjectSlice(...a),
  ...createSettingsSlice(...a),
  ...createPanelsSlice(...a),
  ...createTasksSlice(...a),
}));
