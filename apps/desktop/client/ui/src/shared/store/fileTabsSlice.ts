import type { StateCreator } from 'zustand';
import { htmlToMarkdown, markdownToHtml } from '../utils/markdown';

let tabIdCounter = 0;

export type FileTabKind = 'text' | 'image';

export type FileTab = {
  id: string;
  path: string;
  name: string;
  content: string;
  savedContent: string;
  kind?: FileTabKind;
  /** For image tabs: data URL (`data:image/png;base64,...`) used for rendering. */
  dataUrl?: string;
};

export type RecentlyClosedTab = {
  path: string;
  name: string;
  kind: FileTabKind;
};

const RECENTLY_CLOSED_LIMIT = 10;

export type PendingBulkClose = {
  dirtyPaths: string[];
  action: 'all' | 'other' | 'right';
  keepPath?: string;
};

export type FileTabsSlice = {
  openFiles: FileTab[];
  activeFilePath: string | null;
  recentlyClosed: RecentlyClosedTab[];
  pinnedPaths: Set<string>;
  /** Path of a file waiting on a "save before close?" confirmation. */
  pendingCloseConfirm: string | null;
  /** Bulk close operation waiting on dirty-file confirmation. */
  pendingBulkClose: PendingBulkClose | null;
  openFile: (path: string, name: string, content: string, options?: { kind?: FileTabKind; dataUrl?: string }) => void;
  closeFile: (path: string) => void;
  /** Close `path` if clean, otherwise set `pendingCloseConfirm` for UI to handle. */
  requestCloseFile: (path: string) => void;
  cancelCloseConfirm: () => void;
  closeOtherFiles: (keepPath: string) => void;
  closeFilesToRight: (anchorPath: string) => void;
  closeAllFiles: () => void;
  confirmBulkClose: (save: boolean) => Promise<void>;
  cancelBulkClose: () => void;
  reopenLastClosedFile: () => Promise<void>;
  cycleActiveFile: (direction: 1 | -1) => void;
  updateFileContent: (path: string, content: string) => void;
  renameOpenFile: (oldPath: string, newPath: string, newName: string) => void;
  saveFile: (path: string) => Promise<boolean>;
  saveAllOpenFiles: () => Promise<void>;
  reloadFile: (path: string) => Promise<void>;
  hasDirtyFiles: () => boolean;
  togglePinTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
};

function rememberClosedTab(prev: RecentlyClosedTab[], tab: FileTab): RecentlyClosedTab[] {
  if (tab.kind === 'image') return prev;
  const filtered = prev.filter((t) => t.path !== tab.path);
  const next: RecentlyClosedTab[] = [{ path: tab.path, name: tab.name, kind: tab.kind ?? 'text' }, ...filtered];
  return next.slice(0, RECENTLY_CLOSED_LIMIT);
}

function dropFromRecentlyClosed(prev: RecentlyClosedTab[], path: string): RecentlyClosedTab[] {
  return prev.filter((t) => t.path !== path);
}

export const createFileTabsSlice: StateCreator<FileTabsSlice, [], [], FileTabsSlice> = (set, get) => ({
  openFiles: [],
  activeFilePath: null,
  recentlyClosed: [],
  pinnedPaths: new Set(),
  pendingCloseConfirm: null,
  pendingBulkClose: null,

  openFile: (path, name, content, options) => {
    const state = get();
    const existing = state.openFiles.find((f) => f.path === path);
    if (existing) {
      (set as any)({ activeFilePath: path, recentlyClosed: dropFromRecentlyClosed(state.recentlyClosed, path), mainView: 'files' });
      return;
    }
    const isMd = name.endsWith('.md');
    const normalized = isMd ? htmlToMarkdown(markdownToHtml(content)) : content;
    const tab: FileTab = {
      id: `tab-${++tabIdCounter}`,
      path,
      name,
      content: normalized,
      savedContent: normalized,
      kind: options?.kind ?? 'text',
      dataUrl: options?.dataUrl,
    };
    (set as any)({
      openFiles: [...state.openFiles, tab],
      activeFilePath: path,
      recentlyClosed: dropFromRecentlyClosed(state.recentlyClosed, path),
      mainView: 'files',
    });
  },

  closeFile: (path) => {
    const state = get();
    const idx = state.openFiles.findIndex((f) => f.path === path);
    if (idx === -1) return;
    const closing = state.openFiles[idx];
    const next = state.openFiles.filter((f) => f.path !== path);
    let nextActive = state.activeFilePath;
    if (state.activeFilePath === path) {
      if (next.length === 0) {
        nextActive = null;
      } else if (idx >= next.length) {
        nextActive = next[next.length - 1].path;
      } else {
        nextActive = next[idx].path;
      }
    }
    set({
      openFiles: next,
      activeFilePath: nextActive,
      recentlyClosed: rememberClosedTab(state.recentlyClosed, closing),
      pendingCloseConfirm: state.pendingCloseConfirm === path ? null : state.pendingCloseConfirm,
    });
  },

  requestCloseFile: (path) => {
    const state = get();
    const tab = state.openFiles.find((f) => f.path === path);
    if (!tab) return;
    const isDirty = tab.kind === 'text' && tab.content !== tab.savedContent;
    if (isDirty) {
      set({ pendingCloseConfirm: path });
    } else {
      get().closeFile(path);
    }
  },

  cancelCloseConfirm: () => {
    set({ pendingCloseConfirm: null });
  },

  closeOtherFiles: (keepPath) => {
    const state = get();
    const closing = state.openFiles.filter((f) => f.path !== keepPath);
    const dirty = closing.filter((f) => f.kind === 'text' && f.content !== f.savedContent);
    if (dirty.length > 0) {
      set({ pendingBulkClose: { dirtyPaths: dirty.map((f) => f.path), action: 'other', keepPath } });
      return;
    }
    const keep = state.openFiles.find((f) => f.path === keepPath);
    if (!keep) return;
    let recentlyClosed = state.recentlyClosed;
    for (const tab of closing) {
      recentlyClosed = rememberClosedTab(recentlyClosed, tab);
    }
    set({
      openFiles: [keep],
      activeFilePath: keepPath,
      recentlyClosed,
    });
  },

  closeFilesToRight: (anchorPath) => {
    const state = get();
    const idx = state.openFiles.findIndex((f) => f.path === anchorPath);
    if (idx === -1) return;
    const remaining = state.openFiles.slice(0, idx + 1);
    const closing = state.openFiles.slice(idx + 1);
    const dirty = closing.filter((f) => f.kind === 'text' && f.content !== f.savedContent);
    if (dirty.length > 0) {
      set({ pendingBulkClose: { dirtyPaths: dirty.map((f) => f.path), action: 'right', keepPath: anchorPath } });
      return;
    }
    let recentlyClosed = state.recentlyClosed;
    for (const tab of closing) {
      recentlyClosed = rememberClosedTab(recentlyClosed, tab);
    }
    let nextActive = state.activeFilePath;
    if (nextActive && !remaining.some((f) => f.path === nextActive)) {
      nextActive = anchorPath;
    }
    set({ openFiles: remaining, activeFilePath: nextActive, recentlyClosed });
  },

  closeAllFiles: () => {
    const state = get();
    const dirty = state.openFiles.filter((f) => f.kind === 'text' && f.content !== f.savedContent);
    if (dirty.length > 0) {
      set({ pendingBulkClose: { dirtyPaths: dirty.map((f) => f.path), action: 'all' } });
      return;
    }
    let recentlyClosed = state.recentlyClosed;
    for (const tab of state.openFiles) {
      recentlyClosed = rememberClosedTab(recentlyClosed, tab);
    }
    set({ openFiles: [], activeFilePath: null, recentlyClosed });
  },

  async confirmBulkClose(save) {
    const bulk = get().pendingBulkClose;
    if (!bulk) return;
    if (save) {
      await Promise.all(bulk.dirtyPaths.map((p) => get().saveFile(p)));
    }
    set({ pendingBulkClose: null });
    // Re-execute the close operation (now all dirty files are saved or discardable)
    if (bulk.action === 'all') {
      const state = get();
      let recentlyClosed = state.recentlyClosed;
      for (const tab of state.openFiles) {
        recentlyClosed = rememberClosedTab(recentlyClosed, tab);
      }
      set({ openFiles: [], activeFilePath: null, recentlyClosed });
    } else if (bulk.action === 'other' && bulk.keepPath) {
      const state = get();
      const keep = state.openFiles.find((f) => f.path === bulk.keepPath);
      if (keep) {
        let recentlyClosed = state.recentlyClosed;
        for (const tab of state.openFiles.filter((f) => f.path !== bulk.keepPath)) {
          recentlyClosed = rememberClosedTab(recentlyClosed, tab);
        }
        set({ openFiles: [keep], activeFilePath: bulk.keepPath, recentlyClosed });
      }
    } else if (bulk.action === 'right' && bulk.keepPath) {
      const state = get();
      const idx = state.openFiles.findIndex((f) => f.path === bulk.keepPath);
      if (idx !== -1) {
        const remaining = state.openFiles.slice(0, idx + 1);
        let recentlyClosed = state.recentlyClosed;
        for (const tab of state.openFiles.slice(idx + 1)) {
          recentlyClosed = rememberClosedTab(recentlyClosed, tab);
        }
        let nextActive = state.activeFilePath;
        if (nextActive && !remaining.some((f) => f.path === nextActive)) {
          nextActive = bulk.keepPath;
        }
        set({ openFiles: remaining, activeFilePath: nextActive, recentlyClosed });
      }
    }
  },

  cancelBulkClose: () => set({ pendingBulkClose: null }),

  reopenLastClosedFile: async () => {
    const state = get();
    const last = state.recentlyClosed[0];
    if (!last) return;
    const rest = state.recentlyClosed.slice(1);
    if (last.kind === 'image') {
      set({ recentlyClosed: rest });
      return;
    }
    const content = await window.orisonDesktop?.readFile(last.path);
    if (content === null || content === undefined) {
      set({ recentlyClosed: rest });
      return;
    }
    get().openFile(last.path, last.name, content, { kind: 'text' });
    set({ recentlyClosed: rest });
  },

  cycleActiveFile: (direction) => {
    const state = get();
    if (state.openFiles.length < 2) return;
    const idx = state.activeFilePath
      ? state.openFiles.findIndex((f) => f.path === state.activeFilePath)
      : 0;
    const nextIdx = (idx + direction + state.openFiles.length) % state.openFiles.length;
    set({ activeFilePath: state.openFiles[nextIdx].path });
  },

  updateFileContent: (path, content) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, content } : f,
      ),
    }));
  },

  renameOpenFile: (oldPath, newPath, newName) => {
    const state = get();
    const hasTab = state.openFiles.some((f) => f.path === oldPath);
    if (!hasTab) return;
    const nextPinned = new Set(state.pinnedPaths);
    if (nextPinned.has(oldPath)) {
      nextPinned.delete(oldPath);
      nextPinned.add(newPath);
    }
    set({
      openFiles: state.openFiles.map((f) =>
        f.path === oldPath ? { ...f, path: newPath, name: newName } : f,
      ),
      activeFilePath: state.activeFilePath === oldPath ? newPath : state.activeFilePath,
      pinnedPaths: nextPinned,
    });
  },

  saveFile: async (path) => {
    const state = get();
    const file = state.openFiles.find((f) => f.path === path);
    if (!file) return false;
    if (file.kind === 'image') return true;
    try {
      const ok = await window.orisonDesktop?.writeFile(file.path, file.content);
      if (ok === false) return false;
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path ? { ...f, savedContent: f.content } : f,
        ),
      }));
      return true;
    } catch {
      return false;
    }
  },

  saveAllOpenFiles: async () => {
    const dirty = get().openFiles.filter(
      (f) => f.kind === 'text' && f.content !== f.savedContent,
    );
    await Promise.all(dirty.map((f) => get().saveFile(f.path)));
  },

  async reloadFile(path) {
    const tab = get().openFiles.find((f) => f.path === path);
    if (!tab || tab.kind !== 'text') return;
    try {
      const raw = await window.orisonDesktop?.readFile(path);
      if (typeof raw !== 'string') return;
      const isMd = tab.name.endsWith('.md');
      const content = isMd ? htmlToMarkdown(markdownToHtml(raw)) : raw;
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path ? { ...f, content, savedContent: content } : f,
        ),
      }));
    } catch { /* ignore read errors */ }
  },

  hasDirtyFiles: () => get().openFiles.some((f) => f.kind === 'text' && f.content !== f.savedContent),

  togglePinTab: (path) => {
    const state = get();
    const next = new Set(state.pinnedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    // Sort: pinned tabs first, preserve relative order within each group
    const pinned = state.openFiles.filter((f) => next.has(f.path));
    const unpinned = state.openFiles.filter((f) => !next.has(f.path));
    set({ pinnedPaths: next, openFiles: [...pinned, ...unpinned] });
  },

  reorderTabs: (fromIndex, toIndex) => {
    const state = get();
    if (fromIndex === toIndex) return;
    const files = [...state.openFiles];
    const [moved] = files.splice(fromIndex, 1);
    files.splice(toIndex, 0, moved);
    set({ openFiles: files });
  },
});
