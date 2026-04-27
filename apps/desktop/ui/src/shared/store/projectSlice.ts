import type { StateCreator } from 'zustand';
import type { ProjectMeta, WorkspaceModule } from './types';

export type ProjectSlice = {
  currentProject: ProjectMeta | null;
  openProject: (project: ProjectMeta) => void;
  closeProject: () => void;
  saveProject: () => Promise<void>;
  activeModule: WorkspaceModule;
  setActiveModule: (module: WorkspaceModule) => void;
};

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set, get) => ({
  currentProject: null,
  openProject: (project) => set({ currentProject: project }),
  closeProject: () => set({ currentProject: null }),
  async saveProject() {
    const project = get().currentProject;
    if (!project?.path) return;
    if (window.orisonDesktop?.saveProjectMeta) {
      await window.orisonDesktop.saveProjectMeta(project.path, {
        name: project.name,
        type: project.type,
        coverImage: project.coverImage ?? null,
      });
    }
  },
  activeModule: 'outline',
  setActiveModule: (activeModule) => set({ activeModule }),
});
