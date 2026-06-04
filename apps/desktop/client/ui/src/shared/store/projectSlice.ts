import type { StateCreator } from 'zustand';
import type { ProjectMeta } from './types';

export type ProjectSlice = {
  currentProject: ProjectMeta | null;
  projectDocumentHydrated: boolean;
  projectWordCount: number;
  openProject: (project: ProjectMeta) => void;
  closeProject: () => void;
  saveProject: () => Promise<void>;
  refreshWordCount: () => Promise<void>;
};

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set, get) => ({
  currentProject: null,
  projectDocumentHydrated: false,
  projectWordCount: 0,
  openProject: (project) => {
    set({
      currentProject: project,
      projectDocumentHydrated: false,
      projectWordCount: 0,
    });
  },
  closeProject: () => {
    const state = get() as any;
    if (state.hasDirtyFiles?.()) {
      state.saveAllOpenFiles?.();
    }
    set({
      currentProject: null,
      projectDocumentHydrated: false,
      projectWordCount: 0,
    });
  },
  async saveProject() {
    const project = get().currentProject;
    if (!project?.path) return;
    const meta = {
      name: project.name,
      type: project.type,
      logline: project.logline ?? null,
      synopsis: project.synopsis ?? null,
      genre: project.genre ?? null,
      theme: project.theme ?? null,
      writing_style: project.writingStyle ?? null,
      tone: project.tone ?? null,
      coverImage: project.coverImage ?? null,
    };
    if (window.orisonDesktop?.saveProjectMeta) {
      await window.orisonDesktop.saveProjectMeta(project.path, meta);
    }
    if (window.orisonDesktop?.syncProjectMeta) {
      await window.orisonDesktop.syncProjectMeta(project.path, meta);
    }
  },
  async refreshWordCount() {
    const project = get().currentProject;
    if (!project?.path) return;
    const count = await window.orisonDesktop?.wordCount(project.path) ?? 0;
    set({ projectWordCount: count });
  },
});
