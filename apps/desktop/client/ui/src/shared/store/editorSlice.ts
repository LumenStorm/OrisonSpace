import type { StateCreator } from 'zustand';
import { normalizePath } from '../utils/paths';
import { registerProjectReset } from './resetRegistry';

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

  addChapter: (title?: string) => Promise<void>;
  removeChapter: (id: string) => void;
  reorderChapter: (id: string, direction: 'up' | 'down') => void;
  moveChapter: (fromIndex: number, toIndex: number) => void;
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
  EditorSlice & { currentProject: { path: string } | null; openFile: (path: string, name: string, content: string) => void },
  [],
  [],
  EditorSlice
> = (set, get) => {
  // The legacy editor chapter list + undo/redo history are project-scoped. Drop
  // them on switch so undo can't cross project boundaries.
  registerProjectReset(() => {
    set({ chapters: [], activeChapterId: null, undoStack: [], redoStack: [] });
  });

  return {
  chapters: [],
  activeChapterId: null,
  undoStack: [],
  redoStack: [],

  addChapter: async (title) => {
    const state = get();
    const snapshot = snap(state);
    const id = `ch-${Date.now()}`;
    const chapterTitle = title ?? `Chapter ${state.chapters.length + 1}`;

    // Generate filename: chapter-01.md, chapter-02.md, ...
    const num = state.chapters.length + 1;
    const padded = String(num).padStart(2, '0');
    const filename = `chapter-${padded}.md`;

    const ch: Chapter = { id, title: chapterTitle, content: '' };
    set({
      undoStack: [...state.undoStack.slice(-MAX_UNDO + 1), snapshot],
      redoStack: [],
      chapters: [...state.chapters, ch],
      activeChapterId: id,
    });

    // Create file and open in tabs
    if (state.currentProject?.path) {
      const chapterDir = normalizePath(`${state.currentProject.path}/chapters`);
      const filePath = `${chapterDir}/${filename}`;
      await window.orisonDesktop?.createEntry(chapterDir, true);
      await window.orisonDesktop?.writeFile(filePath, '');
      state.openFile(filePath, filename, '');
    }
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

  reorderChapter: (id, direction) => {
    const state = get();
    const idx = state.chapters.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= state.chapters.length) return;
    const snapshot = snap(state);
    const next = [...state.chapters];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    set({
      undoStack: [...state.undoStack.slice(-MAX_UNDO + 1), snapshot],
      redoStack: [],
      chapters: next,
    });
  },

  moveChapter: (fromIndex, toIndex) => {
    const state = get();
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= state.chapters.length) return;
    if (toIndex < 0 || toIndex >= state.chapters.length) return;
    const snapshot = snap(state);
    const next = [...state.chapters];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    set({
      undoStack: [...state.undoStack.slice(-MAX_UNDO + 1), snapshot],
      redoStack: [],
      chapters: next,
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

  // 旧版编辑器章节列表（{id,title,content}）曾被缓存进已废弃的 project.json `chapters`
  // 键，但该缓存从无读取方（loadChaptersFromProject 全仓零调用）。移除 project.json 后
  // 这两个方法不再落盘：正文真相源是打开的 .md 文件（saveAllOpenFiles）+ project.yaml
  // 的 novel.chapters（setNovelChapters/syncChaptersMeta）。保留签名避免改动调用方。
  async saveChaptersToProject() {
    /* no-op：旧 json chapters 缓存已废弃，正文持久化走文件 + novel.chapters */
  },

  async loadChaptersFromProject() {
    /* no-op：章节由 projectSubscription 从 project.yaml 的 novel.chapters 水合 */
  },
  };
};
