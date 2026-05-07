import type { StateCreator } from 'zustand';
import type { ProjectMeta } from './types';
import { storage } from './storage';

const STORAGE_KEY = 'recent_projects';
const MAX_RECENT = 12;

function loadInitial(): ProjectMeta[] {
  const raw = storage.get<ProjectMeta[]>(STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is ProjectMeta =>
    Boolean(item) && typeof item.name === 'string' && typeof item.path === 'string'
  );
}

function persist(projects: ProjectMeta[]): void {
  storage.set(STORAGE_KEY, projects);
}

export type RecentProjectsSlice = {
  recentProjects: ProjectMeta[];
  addRecentProject: (project: ProjectMeta) => void;
  removeRecentProject: (path: string) => void;
  replaceRecentProjects: (projects: ProjectMeta[]) => void;
  clearRecentProjects: () => void;
};

export const createRecentProjectsSlice: StateCreator<RecentProjectsSlice, [], [], RecentProjectsSlice> = (set, get) => ({
  recentProjects: loadInitial(),

  addRecentProject(project) {
    const current = get().recentProjects;
    const filtered = current.filter((item) => item.path !== project.path);
    const next = [project, ...filtered].slice(0, MAX_RECENT);
    persist(next);
    set({ recentProjects: next });
  },

  removeRecentProject(path) {
    const next = get().recentProjects.filter((item) => item.path !== path);
    persist(next);
    set({ recentProjects: next });
  },

  replaceRecentProjects(projects) {
    const seen = new Set<string>();
    const next = projects.filter((project) => {
      if (seen.has(project.path)) return false;
      seen.add(project.path);
      return true;
    }).slice(0, MAX_RECENT);
    persist(next);
    set({ recentProjects: next });
  },

  clearRecentProjects() {
    persist([]);
    set({ recentProjects: [] });
  },
});
