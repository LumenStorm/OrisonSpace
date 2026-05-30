import type { StateCreator } from 'zustand';
import type { ProjectMeta } from './types';

export type ProjectSlice = {
  currentProject: ProjectMeta | null;
  projectDocumentHydrated: boolean;
  openProject: (project: ProjectMeta) => void;
  closeProject: () => void;
  saveProject: () => Promise<void>;
};

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set, get) => ({
  currentProject: null,
  projectDocumentHydrated: false,
  openProject: (project) => {
    set({
      currentProject: project,
      projectDocumentHydrated: false,
    });
  },
  closeProject: () => set({
    currentProject: null,
    projectDocumentHydrated: false,
  }),
  async saveProject() {
    const project = get().currentProject;
    if (!project?.path) return;
    if (window.orisonDesktop?.saveProjectMeta) {
      await window.orisonDesktop.saveProjectMeta(project.path, {
        name: project.name,
        type: project.type,
        logline: project.logline ?? null,
        synopsis: project.synopsis ?? null,
        genre: project.genre ?? null,
        theme: project.theme ?? null,
        writing_style: project.writingStyle ?? null,
        tone: project.tone ?? null,
        coverImage: project.coverImage ?? null,
      });
    }
  },
});
