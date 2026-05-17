import type { StateCreator } from 'zustand';
import type { ProjectMeta, WorkspaceModule } from './types';
import type { RecentProjectsSlice } from './recentProjectsSlice';
import type { BackgroundTasksSlice } from './backgroundTasksSlice';
import type { CreativeFieldsSlice } from './creativeFieldsSlice';
import type { NovelChapterSlice } from './novelChapterSlice';

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
    // Hydrate background tasks from SQLite for this project.
    const loadBg = (get() as unknown as BackgroundTasksSlice).loadBgTasks;
    if (typeof loadBg === 'function') loadBg();
    // Hydrate creative fields from project.yaml.
    if (project.path && window.orisonDesktop?.loadProjectDocument) {
      window.orisonDesktop.loadProjectDocument(project.path).then((doc) => {
        if (!doc) return;
        const loadFields = (get() as unknown as CreativeFieldsSlice).loadCreativeFields;
        if (typeof loadFields === 'function') loadFields(doc as any);
        const setChapters = (get() as unknown as NovelChapterSlice).setNovelChapters;
        if (typeof setChapters === 'function' && Array.isArray((doc as any).novel?.chapters)) {
          setChapters((doc as any).novel.chapters.map((ch: any) => ({
            id: ch.id,
            title: ch.title,
            sortOrder: ch.sort_order,
            status: ch.status ?? 'draft',
            summary: ch.summary,
            summarySource: ch.summary_source,
            sections: (ch.sections ?? []).map((s: any) => ({
              id: s.id,
              title: s.title,
              sortOrder: s.sort_order,
              contentFile: s.content_file,
              wordCount: s.word_count,
            })),
          })));
        }
      }).catch(() => {});
    }
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
  activeModule: 'overview',
  setActiveModule: (activeModule) => set({ activeModule }),
});
