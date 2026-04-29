import { create } from 'zustand';
import { createAuthSlice, type AuthSlice } from './authSlice';
import { createProjectSlice, type ProjectSlice } from './projectSlice';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice';
import { createPanelsSlice, type PanelsSlice } from './panelsSlice';
import { createTasksSlice, type TasksSlice } from './tasksSlice';
import { createCreativeFieldsSlice, type CreativeFieldsSlice } from './creativeFieldsSlice';
import { createEditorSlice, type EditorSlice } from './editorSlice';
import { createFileTabsSlice, type FileTabsSlice } from './fileTabsSlice';

export type { WorkspaceModule, BottomPanelTab, ThemeSetting, LocaleSetting, ProjectMeta, UserInfo } from './types';

type AppState = AuthSlice & ProjectSlice & SettingsSlice & PanelsSlice & TasksSlice & CreativeFieldsSlice & EditorSlice & FileTabsSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createProjectSlice(...a),
  ...createSettingsSlice(...a),
  ...createPanelsSlice(...a),
  ...createTasksSlice(...a),
  ...createCreativeFieldsSlice(...a),
  ...createEditorSlice(...a),
  ...createFileTabsSlice(...a),
}));
