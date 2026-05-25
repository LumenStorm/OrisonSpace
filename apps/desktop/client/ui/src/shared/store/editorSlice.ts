import type { StateCreator } from 'zustand';

export type Chapter = {
  id: string;
  title: string;
  content: string;
};

type EditorSnapshot = {
  chapters: Chapter[];
  activeChapterId: string | null;
};

export type EditorSlice = {
  chapters: Chapter[];
  activeChapterId: string | null;
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];

  addChapter: (title?: string) => void;
  removeChapter: (id: string) => void;
  updateChapter: (id: string, patch: Partial<Omit<Chapter, 'id'>>) => void;
  setActiveChapter: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveChaptersToProject: () => Promise<void>;
  loadChaptersFromProject: () => Promise<void>;
};

const MAX_UNDO = 50;

function snap(state: { chapters: Chapter[]; activeChapterId: string | null }): EditorSnapshot {
  return {
    chapters: state.chapters.map((c) => ({ ...c })),
    activeChapterId: state.activeChapterId,
  };
}

export const createEditorSlice: StateCreator<
  EditorSlice & { currentProject: { path: string } | null },
  [],
  [],
  EditorSlice
> = (set, get) => ({
  chapters: [],
  activeChapterId: null,
  undoStack: [],
  redoStack: [],

  addChapter: (title) => {
    const state = get();
    const snapshot = snap(state);
    const id = `ch-${Date.now()}`;
    const ch: Chapter = { id, title: title ?? `Chapter ${state.chapters.length + 1}`, content: '' };
    set({
      undoStack: [...state.undoStack.slice(-MAX_UNDO + 1), snapshot],
      redoStack: [],
      chapters: [...state.chapters, ch],
      activeChapterId: id,
    });
  },

  removeChapter: (id) => {
    const state = get();
    const snapshot = snap(state);
    const next = state.chapters.filter((c) => c.id !== id);
    set({
      undoStack: [...state.undoStack.slice(-MAX_UNDO + 1), snapshot],
      redoStack: [],
      chapters: next,
      activeChapterId: state.activeChapterId === id ? (next[0]?.id ?? null) : state.activeChapterId,
    });
  },

  updateChapter: (id, patch) => {
    const state = get();
    const snapshot = snap(state);
    set({
      undoStack: [...state.undoStack.slice(-MAX_UNDO + 1), snapshot],
      redoStack: [],
      chapters: state.chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  },

  setActiveChapter: (id) => set({ activeChapterId: id }),

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const current = snap(state);
    const prev = state.undoStack[state.undoStack.length - 1];
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack.slice(-MAX_UNDO + 1), current],
      chapters: prev.chapters,
      activeChapterId: prev.activeChapterId,
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const current = snap(state);
    const next = state.redoStack[state.redoStack.length - 1];
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack.slice(-MAX_UNDO + 1), current],
      chapters: next.chapters,
      activeChapterId: next.activeChapterId,
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  async saveChaptersToProject() {
    const { currentProject, chapters } = get();
    if (!currentProject?.path) return;
    await window.orisonDesktop?.saveProjectMeta(currentProject.path, {
      ...(await window.orisonDesktop?.loadProjectMeta(currentProject.path) ?? {}),
      chapters,
    });
  },

  async loadChaptersFromProject() {
    const { currentProject } = get();
    if (!currentProject?.path) return;
    const meta = await window.orisonDesktop?.loadProjectMeta(currentProject.path);
    if (meta?.chapters && Array.isArray(meta.chapters)) {
      const chapters = meta.chapters as Chapter[];
      set({
        chapters,
        activeChapterId: chapters[0]?.id ?? null,
        undoStack: [],
        redoStack: [],
      });
    }
  },
});
