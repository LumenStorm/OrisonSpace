import type { StateCreator } from 'zustand';
import type { ProjectMeta, WorkspaceModule } from './types';
import type { RecentProjectsSlice } from './recentProjectsSlice';

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
  openProject: (project) => {
    set({ currentProject: project });
    // Bridge into the recent-projects slice without coupling slice types.
    const addRecent = (get() as unknown as RecentProjectsSlice).addRecentProject;
    if (typeof addRecent === 'function') addRecent(project);
  },
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
