import type { StateCreator } from 'zustand';
import type { ModelRef } from '@orison/shared-contracts';
import type { AgentMode } from './types';
import {
  createAgentSession,
  fetchAgentSession,
  deleteAgentSession as deleteSession,
  listAgentSessions,
  confirmAgentTool,
  streamAgentMessage,
  type AgentMessage,
  type AgentSessionMeta,
  type AgentStreamEvent,
} from '../api/agent';
import { randomUUID } from '../util/id';

export type { AgentMessage, AgentSessionMeta };

export type AgentSlice = {
  agentMode: AgentMode;
  setAgentMode: (mode: AgentMode) => void;
  agentModelRef: ModelRef | null;
  setAgentModelRef: (ref: ModelRef | null) => void;

  agentSessionId: string | null;
  agentMessages: AgentMessage[];
  agentLoading: boolean;
  agentError: string | null;
  sendAgentMessage: (content: string) => Promise<void>;
  cancelAgent: () => void;
  newAgentSession: () => Promise<void>;

  agentSessions: AgentSessionMeta[];
  loadAgentSessions: () => Promise<void>;
  switchAgentSession: (sessionId: string) => Promise<void>;
  deleteAgentSession: (sessionId: string) => Promise<void>;

  pendingToolConfirm: { callId: string; name: string; input: unknown } | null;
  confirmPendingTool: () => void;
  rejectPendingTool: () => void;

  pendingDiffs: PendingDiff[];
  acceptDiff: (id: string) => void;
  rejectDiff: (id: string) => void;
};

export type PendingDiff = {
  id: string;
  toolId: string;
  fileName: string;
  content: string;
  chapterId?: string;
};

type Deps = AgentSlice & {
  currentProject: { path?: string } | null;
  activeChapterId: string | null;
  chapters: { id: string; title: string; content: string }[];
  updateChapter: (id: string, patch: Partial<{ title: string; content: string }>) => void;
};

const WRITE_TOOLS = ['chapter_write', 'write_file', 'outline_update'];

let activeAbort: AbortController | null = null;

export const createAgentSlice: StateCreator<Deps, [], [], AgentSlice> = (set, get) => ({
  agentMode: 'suggest',
  setAgentMode: (mode) => set({ agentMode: mode }),
  agentModelRef: null,
  setAgentModelRef: (ref) => set({ agentModelRef: ref }),

  agentSessionId: null,
  agentMessages: [],
  agentLoading: false,
  agentError: null,

  pendingDiffs: [],
  acceptDiff(id) {
    const state = get();
    const diff = state.pendingDiffs.find((d) => d.id === id);
    if (!diff) return;
    // Find matching chapter and write content
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

  async sendAgentMessage(content) {
    const state = get();
    const projectPath = state.currentProject?.path;
    if (!projectPath) return;

    // Build context from current editor state
    let messageContent = content;
    if (state.activeChapterId) {
      const chapter = state.chapters.find((c) => c.id === state.activeChapterId);
      if (chapter) {
        const preview = chapter.content.slice(0, 1500);
        messageContent = `[Context: editing "${chapter.title}"]\n${preview}\n---\n${content}`;
      }
    }

    let sessionId = state.agentSessionId;
    if (!sessionId) {
      const session = await createAgentSession(projectPath, state.agentMode, state.agentModelRef);
      sessionId = session.id;
      set({ agentSessionId: sessionId });
    }

    const userMsg: AgentMessage = {
      id: randomUUID(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    set((s) => ({ agentMessages: [...s.agentMessages, userMsg], agentLoading: true, agentError: null }));

    const sid = sessionId;
    const mode = state.agentMode;
    activeAbort = streamAgentMessage(sid, messageContent, (event: AgentStreamEvent) => {
      switch (event.type) {
        case 'assistant':
          set((s) => ({
            agentMessages: [...s.agentMessages, {
              id: event.data.id,
              role: 'assistant',
              content: event.data.content,
              toolCalls: event.data.toolCalls as AgentMessage['toolCalls'],
              createdAt: Date.now(),
            }],
          }));
          break;
        case 'tool': {
          const toolMsg: AgentMessage = {
            id: event.data.id,
            role: 'tool',
            content: '',
            toolResults: event.data.results as AgentMessage['toolResults'],
            createdAt: Date.now(),
          };
          set((s) => ({ agentMessages: [...s.agentMessages, toolMsg] }));

          // Handle write tools based on mode
          if (mode !== 'readonly') {
            const results = event.data.results as Array<{ toolId?: string; output?: string; metadata?: unknown }>;
            for (const result of results) {
              if (WRITE_TOOLS.includes(result.toolId ?? '')) {
                const meta = result.metadata as { fileName?: string; content?: string; chapterId?: string } | undefined;
                if (meta?.content) {
                  if (mode === 'auto') {
                    // Direct write
                    const currentState = get();
                    const chapter = currentState.chapters.find((c) =>
                      meta.chapterId ? c.id === meta.chapterId : c.title.includes((meta.fileName ?? '').replace('.md', ''))
                    );
                    if (chapter) {
                      currentState.updateChapter(chapter.id, { content: meta.content });
                    }
                  } else {
                    // suggest mode: queue diff for user approval
                    set((s) => ({
                      pendingDiffs: [...s.pendingDiffs, {
                        id: randomUUID(),
                        toolId: result.toolId ?? 'unknown',
                        fileName: meta.fileName ?? 'unknown',
                        content: meta.content!,
                        chapterId: meta.chapterId,
                      }],
                    }));
                  }
                }
              }
            }
          }
          break;
        }
        case 'confirm_required':
          set({ pendingToolConfirm: event.data, agentLoading: false });
          break;
        case 'done':
          set({ agentLoading: false });
          break;
        case 'error':
          set({ agentError: event.data.message, agentLoading: false });
          break;
      }
    });
  },

  cancelAgent() {
    activeAbort?.abort();
    activeAbort = null;
    set({ agentLoading: false });
  },

  async newAgentSession() {
    activeAbort?.abort();
    activeAbort = null;
    set({ agentSessionId: null, agentMessages: [], agentLoading: false, agentError: null, pendingToolConfirm: null, pendingDiffs: [] });
  },

  agentSessions: [],
  async loadAgentSessions() {
    const projectPath = get().currentProject?.path;
    if (!projectPath) return;
    const sessions = await listAgentSessions(projectPath);
    set({ agentSessions: sessions });
  },

  async switchAgentSession(sessionId) {
    activeAbort?.abort();
    activeAbort = null;
    try {
      const data = await fetchAgentSession(sessionId);
      set({ agentSessionId: sessionId, agentMessages: data.messages, agentLoading: false, agentError: null });
    } catch { /* ignore */ }
  },

  async deleteAgentSession(sessionId) {
    await deleteSession(sessionId);
    set((s) => ({ agentSessions: s.agentSessions.filter((ss) => ss.id !== sessionId) }));
    if (get().agentSessionId === sessionId) {
      set({ agentSessionId: null, agentMessages: [] });
    }
  },

  pendingToolConfirm: null,
  confirmPendingTool() {
    const pending = get().pendingToolConfirm;
    const sessionId = get().agentSessionId;
    if (!pending || !sessionId) return;
    set({ pendingToolConfirm: null, agentLoading: true });
    confirmAgentTool(sessionId, pending.callId, true);
  },
  rejectPendingTool() {
    const pending = get().pendingToolConfirm;
    const sessionId = get().agentSessionId;
    if (!pending || !sessionId) return;
    set({ pendingToolConfirm: null, agentLoading: true });
    confirmAgentTool(sessionId, pending.callId, false);
  },
});
