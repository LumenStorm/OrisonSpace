import type { StateCreator } from 'zustand';
import type { ChapterAccessor } from './types';
import { resolveAgentConfirmation } from '../api/agent';

export type PendingDiff = {
  id: string;
  toolId: string;
  fileName: string;
  content: string;
  chapterId?: string;
};

export type AgentDiffSlice = {
  pendingDiffs: PendingDiff[];
  acceptDiff: (id: string) => void;
  rejectDiff: (id: string) => void;

  pendingToolConfirm: { callId: string; name: string; input: unknown } | null;
  confirmPendingTool: () => void;
  rejectPendingTool: () => void;
};

type Deps = AgentDiffSlice & ChapterAccessor & {
  agentSessionId: string | null;
  agentLoading: boolean;
};

export const createAgentDiffSlice: StateCreator<Deps, [], [], AgentDiffSlice> = (set, get) => ({
  pendingDiffs: [],
  pendingToolConfirm: null,

  acceptDiff(id) {
    const state = get();
    const diff = state.pendingDiffs.find((d) => d.id === id);
    if (!diff) return;
    const chapter = state.chapters.find((c) =>
      diff.chapterId ? c.id === diff.chapterId : c.title.includes(diff.fileName.replace('.md', ''))
    );
    if (chapter) {
      state.updateChapter(chapter.id, { content: diff.content });
    }
    set({ pendingDiffs: state.pendingDiffs.filter((d) => d.id !== id) });
  },

  rejectDiff(id) {
    set((s) => ({ pendingDiffs: s.pendingDiffs.filter((d) => d.id !== id) }));
  },

  confirmPendingTool() {
    const pending = get().pendingToolConfirm;
    const sessionId = get().agentSessionId;
    if (!pending || !sessionId) return;
    set({ pendingToolConfirm: null, agentLoading: true });
    void resolveAgentConfirmation(sessionId, pending.callId, true);
  },

  rejectPendingTool() {
    const pending = get().pendingToolConfirm;
    const sessionId = get().agentSessionId;
    if (!pending || !sessionId) return;
    set({ pendingToolConfirm: null, agentLoading: true });
    void resolveAgentConfirmation(sessionId, pending.callId, false);
  },
});
