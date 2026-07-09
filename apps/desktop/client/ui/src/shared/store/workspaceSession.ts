import type { ProjectMeta } from './types';
import { storage } from './storage';

export type PersistedFileTabKind = 'text' | 'image' | 'docx';

export type PersistedFileTab = {
  path: string;
  name: string;
  kind: PersistedFileTabKind;
  selectionStart?: number;
  selectionEnd?: number;
  scrollTop?: number;
};

export type ProjectSessionSnapshot = {
  version: 1;
  openFiles: PersistedFileTab[];
  activeFilePath: string | null;
  pinnedPaths: string[];
};

const LAST_PROJECT_KEY = 'workspaceSession:lastProject';

export function projectSessionStorageKey(projectPath: string): string {
  return `workspaceSession:${encodeURIComponent(projectPath)}`;
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeKind(value: unknown): PersistedFileTabKind {
  return value === 'image' || value === 'docx' ? value : 'text';
}

function normalizeFileTab(value: unknown): PersistedFileTab | null {
  const tab = value as Partial<PersistedFileTab> | null;
  if (!tab || typeof tab.path !== 'string' || typeof tab.name !== 'string') return null;
  return {
    path: tab.path,
    name: tab.name,
    kind: normalizeKind(tab.kind),
    selectionStart: normalizeNumber(tab.selectionStart),
    selectionEnd: normalizeNumber(tab.selectionEnd),
    scrollTop: normalizeNumber(tab.scrollTop),
  };
}

function normalizeSnapshot(value: unknown): ProjectSessionSnapshot | null {
  const snapshot = value as Partial<ProjectSessionSnapshot> | null;
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.openFiles)) return null;
  const openFiles = snapshot.openFiles
    .map(normalizeFileTab)
    .filter((tab): tab is PersistedFileTab => tab !== null);
  const openPathSet = new Set(openFiles.map((tab) => tab.path));
  const activeFilePath =
    typeof snapshot.activeFilePath === 'string' && openPathSet.has(snapshot.activeFilePath)
      ? snapshot.activeFilePath
      : openFiles[0]?.path ?? null;
  const pinnedPaths = Array.isArray(snapshot.pinnedPaths)
    ? snapshot.pinnedPaths.filter((path): path is string => typeof path === 'string' && openPathSet.has(path))
    : [];
  return { version: 1, openFiles, activeFilePath, pinnedPaths };
}

export function loadProjectSession(projectPath: string): ProjectSessionSnapshot | null {
  return normalizeSnapshot(storage.get<unknown>(projectSessionStorageKey(projectPath), null));
}

export function persistProjectSession(projectPath: string, snapshot: ProjectSessionSnapshot): void {
  storage.set(projectSessionStorageKey(projectPath), normalizeSnapshot(snapshot) ?? {
    version: 1,
    openFiles: [],
    activeFilePath: null,
    pinnedPaths: [],
  });
}

export function persistLastProject(project: ProjectMeta): void {
  storage.set(LAST_PROJECT_KEY, project);
}

export function loadLastProject(): ProjectMeta | null {
  const project = storage.get<ProjectMeta | null>(LAST_PROJECT_KEY, null);
  if (!project || typeof project.path !== 'string' || !project.path) return null;
  return project;
}

export function clearLastProject(): void {
  storage.remove(LAST_PROJECT_KEY);
}
