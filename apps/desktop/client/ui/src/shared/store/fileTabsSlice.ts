import type { StateCreator } from 'zustand';
import { registerProjectReset } from './resetRegistry';

let tabIdCounter = 0;

export type FileTabKind = 'text' | 'image' | 'docx';

export type FileTab = {
  id: string;
  path: string;
  name: string;
  content: string;
  savedContent: string;
  kind?: FileTabKind;
  /** For image tabs: data URL (`data:image/png;base64,...`) used for rendering. */
  dataUrl?: string;
  /**
   * Set when the file changed on disk outside the editor while this tab has
   * unsaved edits ('changed'), or was deleted on disk ('deleted'). Drives the
   * conflict banner. Cleared on reload or when the user keeps their version.
   */
  externalState?: 'changed' | 'deleted';
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
  /** Force-close the given file and any open files nested under it (used after a
   *  file/dir is deleted on disk, so no "ghost" tab can re-create it). */
  closeFilesUnder: (pathOrDir: string) => void;
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
  saveAllOpenFiles: () => Promise<{ failed: string[] }>;
  reloadFile: (path: string) => Promise<void>;
  /** Flag a tab as changed/deleted on disk while it had unsaved edits. */
  markExternalChange: (path: string, kind: 'changed' | 'deleted') => void;
  /** Dismiss the external-change banner, keeping the in-editor (unsaved) version. */
  keepLocalVersion: (path: string) => void;
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

export const createFileTabsSlice: StateCreator<FileTabsSlice, [], [], FileTabsSlice> = (set, get) => {
  // When the active project changes, drop every open tab and tab-related state.
  // Without this the previous project's tabs stay in the bar and point at its
  // absolute paths — clicking one reads/writes the wrong project's files.
  registerProjectReset(() => {
    set({
      openFiles: [],
      activeFilePath: null,
      recentlyClosed: [],
      pinnedPaths: new Set(),
      pendingCloseConfirm: null,
      pendingBulkClose: null,
    });
  });

  return {
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
    // Keep the on-disk text verbatim. A markdownToHtml→htmlToMarkdown round-trip
    // would silently reformat the user's manuscript (indentation, list markers,
    // emphasis tokens, line breaks) and falsely mark the tab dirty on open.
    // TiptapEditor converts markdown→HTML for display on its own.
    const tab: FileTab = {
      id: `tab-${++tabIdCounter}`,
      path,
      name,
      content,
      savedContent: content,
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
    if (last.kind === 'image' || last.kind === 'docx') {
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
    const splitFilePath: string | null = (state as any).splitFilePath ?? null;
    // Match either the renamed entry itself, or — when a *directory* is renamed —
    // any open file nested under it. A bare `===` check would leave tabs for
    // `dir/a.md` pointing at the old path after `dir` is renamed, so their next
    // save would write to a path that no longer exists.
    const oldPrefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
    const rebase = (p: string): string | null => {
      if (p === oldPath) return newPath;
      if (p.startsWith(oldPrefix)) return newPath + p.slice(oldPath.length);
      return null;
    };
    const affected = state.openFiles.some((f) => rebase(f.path) !== null);
    if (!affected && (splitFilePath === null || rebase(splitFilePath) === null)) return;

    const nextPinned = new Set(state.pinnedPaths);
    for (const p of state.pinnedPaths) {
      const np = rebase(p);
      if (np !== null) {
        nextPinned.delete(p);
        nextPinned.add(np);
      }
    }

    const nextActive = state.activeFilePath ? (rebase(state.activeFilePath) ?? state.activeFilePath) : state.activeFilePath;
    const nextSplit = splitFilePath ? (rebase(splitFilePath) ?? splitFilePath) : splitFilePath;

    (set as any)({
      openFiles: state.openFiles.map((f) => {
        const np = rebase(f.path);
        if (np === null) return f;
        // Only the directly renamed file gets the new display name; nested files
        // keep their own name (only their path prefix changed).
        return f.path === oldPath ? { ...f, path: np, name: newName } : { ...f, path: np };
      }),
      activeFilePath: nextActive,
      splitFilePath: nextSplit,
      pinnedPaths: nextPinned,
    });
  },

  closeFilesUnder: (pathOrDir) => {
    const state = get();
    const prefix = pathOrDir.endsWith('/') ? pathOrDir : `${pathOrDir}/`;
    // Close the file itself and anything nested under it (directory delete).
    // Force-close regardless of dirty state — the file is gone from disk, so a
    // "save before close?" prompt would only let the user re-create it.
    const toClose = state.openFiles.filter(
      (f) => f.path === pathOrDir || f.path.startsWith(prefix),
    );
    if (toClose.length === 0) return;
    for (const tab of toClose) {
      get().closeFile(tab.path);
    }
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
    // Return the paths that failed to persist so callers (e.g. the close guard)
    // can refuse to proceed and warn the user instead of silently losing edits.
    const results = await Promise.all(
      dirty.map(async (f) => ({ path: f.path, ok: await get().saveFile(f.path) })),
    );
    return { failed: results.filter((r) => !r.ok).map((r) => r.path) };
  },

  async reloadFile(path) {
    const tab = get().openFiles.find((f) => f.path === path);
    if (!tab || tab.kind !== 'text') return;
    try {
      const raw = await window.orisonDesktop?.readFile(path);
      if (typeof raw !== 'string') return;
      // Reload the on-disk text verbatim (no markdown round-trip) so a reloaded
      // manuscript matches the file byte-for-byte and starts clean. Clears any
      // external-change flag since the tab now matches disk again.
      set((s) => ({
        openFiles: s.openFiles.map((f) =>
          f.path === path ? { ...f, content: raw, savedContent: raw, externalState: undefined } : f,
        ),
      }));
    } catch { /* ignore read errors */ }
  },

  markExternalChange: (path, kind) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, externalState: kind } : f,
      ),
    }));
  },

  keepLocalVersion: (path) => {
    // Dismiss the banner but keep the user's unsaved buffer. The tab stays dirty;
    // the next save overwrites the external change (last-write-wins, by choice).
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, externalState: undefined } : f,
      ),
    }));
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
    const moved = files[fromIndex];
    if (!moved) return;
    const [removed] = files.splice(fromIndex, 1);
    files.splice(toIndex, 0, removed);
    // Preserve the pinned-first invariant that togglePinTab maintains: a drag
    // must not interleave pinned and unpinned tabs. Re-sort so all pinned tabs
    // stay ahead of unpinned ones while keeping the new relative order within
    // each group.
    if (state.pinnedPaths.size > 0) {
      const pinned = files.filter((f) => state.pinnedPaths.has(f.path));
      const unpinned = files.filter((f) => !state.pinnedPaths.has(f.path));
      set({ openFiles: [...pinned, ...unpinned] });
      return;
    }
    set({ openFiles: files });
  },
  };
};
