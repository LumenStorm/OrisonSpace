import type { StateCreator } from 'zustand';

export type FileTab = {
  path: string;
  name: string;
  content: string;
  savedContent: string;
};

export type FileTabsSlice = {
  openFiles: FileTab[];
  activeFilePath: string | null;
  openFile: (path: string, name: string, content: string) => void;
  closeFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => void;
};

export const createFileTabsSlice: StateCreator<FileTabsSlice, [], [], FileTabsSlice> = (set, get) => ({
  openFiles: [],
  activeFilePath: null,

  openFile: (path, name, content) => {
    const state = get();
    const existing = state.openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFilePath: path });
      return;
    }
    const tab: FileTab = { path, name, content, savedContent: content };
    set({
      openFiles: [...state.openFiles, tab],
      activeFilePath: path,
    });
  },

  closeFile: (path) => {
    const state = get();
    const idx = state.openFiles.findIndex((f) => f.path === path);
    if (idx === -1) return;
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
    set({ openFiles: next, activeFilePath: nextActive });
  },

  updateFileContent: (path, content) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, content } : f,
      ),
    }));
  },

  saveFile: (path) => {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, savedContent: f.content } : f,
      ),
    }));
  },
});
