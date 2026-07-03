import type { StateCreator } from 'zustand';

export type EditorFindMode = 'find' | 'replace';

/**
 * Editor commands issued from outside the editor (menu bar, command palette).
 * The active editor (Tiptap / CodeEditor) subscribes to `findRequest` and opens
 * its own find bar when the nonce changes. Using a monotonically increasing
 * nonce (rather than a boolean) lets repeated menu clicks re-trigger the bar
 * even while it's already open — and avoids the old synthetic-KeyboardEvent
 * dispatch that never reached the editor's scoped keydown listener.
 */
export type EditorCommandSlice = {
  findRequest: { nonce: number; mode: EditorFindMode } | null;
  requestFind: (mode: EditorFindMode) => void;
};

export const createEditorCommandSlice: StateCreator<EditorCommandSlice, [], [], EditorCommandSlice> = (set) => ({
  findRequest: null,
  requestFind(mode) {
    set((s) => ({ findRequest: { nonce: (s.findRequest?.nonce ?? 0) + 1, mode } }));
  },
});
