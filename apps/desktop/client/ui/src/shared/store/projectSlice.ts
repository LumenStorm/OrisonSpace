import type { StateCreator } from 'zustand';
import type { ProjectMeta } from './types';
import { clearLastProject, loadLastProject, persistLastProject } from './workspaceSession';

export type ProjectSlice = {
  currentProject: ProjectMeta | null;
  projectDocumentHydrated: boolean;
  projectWordCount: number;
  openProject: (project: ProjectMeta) => Promise<{ opened: boolean; failed: string[]; error?: string }>;
  restoreLastProject: () => void;
  /** Update meta fields of the *current* project in place (name/logline/…)
   *  WITHOUT resetting projectDocumentHydrated or re-running the project-switch
   *  subscription. Used by the Overview editor so saving a rename can't be
   *  mistaken for a project switch (which would wipe creativeFields + reload
   *  the document and clobber in-flight Outline edits). */
  updateProjectMeta: (patch: Partial<ProjectMeta>) => void;
  closeProject: () => Promise<{ closed: boolean; failed: string[]; error?: string }>;
  saveProject: () => Promise<void>;
  /** Flush in-memory dirty edits to disk (open text tabs + chapter meta) so a
   *  subsequent on-disk read sees the latest content. */
  flushDirty: () => Promise<{ failed: string[]; error?: string }>;
  refreshWordCount: () => Promise<void>;
};

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set, get) => {
  let openRequestToken = 0;
  let projectMetaPath: string | null = null;
  let projectMetaVersion = 0;
  let savedProjectMetaVersion = 0;
  const syncProjectMetaScope = (path: string | null) => {
    if (projectMetaPath === path) return;
    projectMetaPath = path;
    projectMetaVersion = 0;
    savedProjectMetaVersion = 0;
  };

  return {
  currentProject: null,
  projectDocumentHydrated: false,
  projectWordCount: 0,
  openProject: async (project) => {
    const requestToken = ++openRequestToken;
    const previousPath = get().currentProject?.path ?? null;
    syncProjectMetaScope(previousPath);
    const isSwitch = previousPath !== null && previousPath !== project.path;
    const state = get() as any;
    const hasPendingMeta = projectMetaVersion > savedProjectMetaVersion;
    if (isSwitch && (state.hasDirtyFiles?.() || hasPendingMeta)) {
      const result = await get().flushDirty();
      if (result.failed.length > 0 || result.error) {
        return { opened: false, ...result };
      }
      if (requestToken !== openRequestToken || (get().currentProject?.path ?? null) !== previousPath) {
        return { opened: false, failed: [] };
      }
    }
    set({
      currentProject: project,
      projectDocumentHydrated: false,
      projectWordCount: 0,
    });
    syncProjectMetaScope(project.path ?? null);
    persistLastProject(project);
    // Bump the registry's last-opened time so ProjectsPage orders recents
    // correctly. Best-effort: ordering only, never blocks opening.
    if (project.path) {
      void window.orisonDesktop?.touchProjectRegistration?.({
        localFingerprint: project.path,
        coverImage: project.coverImage,
      }).catch(() => {});
    }
    return { opened: true, failed: [] };
  },
  restoreLastProject: () => {
    if (get().currentProject) return;
    const project = loadLastProject();
    if (project) void get().openProject(project);
  },
  updateProjectMeta: (patch) => {
    const current = get().currentProject;
    if (!current) return;
    // In-place meta update: keep the SAME logical project (same path) so the
    // project-switch subscription's path check treats this as an edit, not a
    // switch — no creativeFields wipe, no document reload, no hydrated reset.
    const next = { ...current, ...patch };
    syncProjectMetaScope(current.path ?? null);
    projectMetaVersion += 1;
    set({ currentProject: next });
    persistLastProject(next);
  },
  closeProject: async () => {
    const projectPath = get().currentProject?.path ?? null;
    const result = await get().flushDirty();
    if (result.failed.length > 0 || result.error) {
      return { closed: false, ...result };
    }
    if ((get().currentProject?.path ?? null) !== projectPath) {
      return { closed: false, failed: [] };
    }
    set({
      currentProject: null,
      projectDocumentHydrated: false,
      projectWordCount: 0,
    });
    syncProjectMetaScope(null);
    clearLastProject();
    return { closed: true, failed: [] };
  },
  async saveProject() {
    const project = get().currentProject;
    if (!project?.path) return;
    syncProjectMetaScope(project.path);
    const savingVersion = projectMetaVersion;
    // project.json 已废弃：meta 直接落 project.yaml。saveProjectMeta 现在就是写 yaml meta，
    // 单次调用即可（旧版 saveProjectMeta + syncProjectMeta 双写已是同一目标，去重）。
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
      projectId: project.projectId ?? null,
    };
    if (window.orisonDesktop?.saveProjectMeta) {
      await window.orisonDesktop.saveProjectMeta(project.path, meta);
    }
    if (get().currentProject?.path === project.path && projectMetaPath === project.path) {
      savedProjectMetaVersion = Math.max(savedProjectMetaVersion, savingVersion);
    }
  },
  async flushDirty() {
    const state = get() as any;
    const projectPath = state.currentProject?.path ?? null;
    syncProjectMetaScope(projectPath);
    // Persist dirty open text tabs (the manuscript files word count reads).
    // refreshWordCount calls this, so navigating to the Overview/word-count
    // surfaces a save. Reflect that in saveStatus so the flush isn't silent —
    // otherwise the dirty indicator just vanishes with no "saved" feedback.
    const hasDirtyFiles = !!state.hasDirtyFiles?.();
    const hasDirtyMeta = projectMetaVersion > savedProjectMetaVersion;
    if (!hasDirtyFiles && !hasDirtyMeta) return { failed: [] };

    state.setSaveStatus?.('saving');
    try {
      if (hasDirtyFiles) {
        const result = await state.saveAllOpenFiles?.() ?? { failed: [] };
        const isCurrentProject = ((get() as any).currentProject?.path ?? null) === projectPath;
        if (result.failed.length > 0) {
          if (isCurrentProject) state.setSaveStatus?.('error');
          return result;
        }
      }

      while (
        projectPath !== null
        && (get() as any).currentProject?.path === projectPath
        && projectMetaPath === projectPath
        && projectMetaVersion > savedProjectMetaVersion
      ) {
        await get().saveProject();
      }

      if (((get() as any).currentProject?.path ?? null) === projectPath) {
        state.setLastSavedAt?.(Date.now());
        state.setSaveStatus?.('saved');
      }
      return { failed: [] };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (((get() as any).currentProject?.path ?? null) === projectPath) {
        state.setSaveStatus?.('error');
      }
      return { failed: [], error };
    }
  },
  async refreshWordCount() {
    const project = get().currentProject;
    if (!project?.path) return;
    // Flush in-memory edits first: word count reads md/txt from disk, so an
    // unsaved buffer would otherwise be counted one edit stale (the bug).
    const result = await get().flushDirty();
    if (result.failed.length > 0 || result.error) return;
    const count = await window.orisonDesktop?.wordCount?.(project.path) ?? 0;
    if (get().currentProject?.path === project.path) {
      set({ projectWordCount: count });
    }
  },
  };
};
