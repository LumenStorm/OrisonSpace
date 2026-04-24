import type { StateCreator } from 'zustand';
import type { ProjectMeta, WorkspaceModule } from './types';

export type ProjectSlice = {
  currentProject: ProjectMeta | null;
  openProject: (project: ProjectMeta) => void;
  closeProject: () => void;
  activeModule: WorkspaceModule;
  setActiveModule: (module: WorkspaceModule) => void;
};

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set) => ({
  currentProject: null,
  openProject: (project) => set({ currentProject: project }),
  closeProject: () => set({ currentProject: null }),
  activeModule: 'outline',
  setActiveModule: (activeModule) => set({ activeModule }),
});
