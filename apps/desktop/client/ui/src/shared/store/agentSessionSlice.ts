import type { StateCreator } from 'zustand';
import type { ModelRef } from '@orison/shared-contracts';
import type { AgentMode } from './types';
import {
  createAgentSession,
  fetchAgentSession,
  deleteAgentSession as deleteSession,
  listAgentSessions,
  streamAgentMessage,
  type AgentMessage,
  type AgentSessionMeta,
  type AgentStreamEvent,
} from '../api/agent';
import { randomUUID } from '../util/id';

export type { AgentMessage, AgentSessionMeta };

const WRITE_TOOLS = ['chapter_write', 'write_file', 'outline_update'];

let activeAbort: { cleanup: () => void; sessionId: string } | null = null;

export type AgentSessionSlice = {
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
};

type Deps = AgentSessionSlice & {
  currentProject: { path?: string } | null;
  activeChapterId: string | null;
  chapters: { id: string; title: string; content: string }[];
  updateChapter: (id: string, patch: Partial<{ title: string; content: string }>) => void;
  pendingDiffs: { id: string; toolId: string; fileName: string; content: string; chapterId?: string }[];
  pendingToolConfirm: { callId: string; name: string; input: unknown } | null;
  latestSkillContinuation: unknown;
  agentContinuations: unknown[];
  restoredSkillContinuation: unknown;
  continuationSourceSessionId: string | null;
};

export const createAgentSessionSlice: StateCreator<Deps, [], [], AgentSessionSlice> = (set, get) => ({
  agentMode: 'suggest',
  setAgentMode: (mode) => set({ agentMode: mode }),
  agentModelRef: null,
  setAgentModelRef: (ref) => set({ agentModelRef: ref }),

  agentSessionId: null,
  agentMessages: [],
  agentLoading: false,
  agentError: null,

  agentSessions: [],

  async sendAgentMessage(content) {
    const state = get();
    const projectPath = state.currentProject?.path;
    if (!projectPath) return;

    let messageContent = content;
    if (state.activeChapterId) {
      const chapter = state.chapters.find((c) => c.id === state.activeChapterId);
      if (chapter) {
        const preview = chapter.content.slice(0, 1500);
        messageContent = `[Context: editing "${chapter.title}"]\n${preview}\n---\n${content}`;
      }
    }

    let sessionId = state.agentSessionId;
    try {
      if (!sessionId) {
        const session = await createAgentSession(projectPath, state.agentMode, state.agentModelRef);
        sessionId = session.id;
        set({ agentSessionId: sessionId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ agentError: `createAgentSession failed: ${message}`, agentLoading: false });
      return;
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
    const { cleanup } = streamAgentMessage(sid, messageContent, (event: AgentStreamEvent) => {
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

          if (mode !== 'readonly') {
            const results = event.data.results as Array<{ toolId?: string; output?: string; metadata?: unknown }>;
            for (const result of results) {
              if (WRITE_TOOLS.includes(result.toolId ?? '')) {
                const meta = result.metadata as { fileName?: string; content?: string; chapterId?: string } | undefined;
                if (meta?.content) {
                  if (mode === 'auto') {
                    const currentState = get();
                    const chapter = currentState.chapters.find((c) =>
                      meta.chapterId ? c.id === meta.chapterId : c.title.includes((meta.fileName ?? '').replace('.md', ''))
                    );
                    if (chapter) {
                      currentState.updateChapter(chapter.id, { content: meta.content });
                    }
                  } else {
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
        case 'child': {
          const { source, role, depth, event: inner } = event.data;
          const tag = `[${source}:${role}${depth > 1 ? `:d${depth}` : ''}]`;
          if (inner.type === 'assistant') {
            set((s) => ({
              agentMessages: [...s.agentMessages, {
                id: inner.data.id,
                role: 'assistant',
                content: `${tag} ${inner.data.content ?? ''}`.trimEnd(),
                toolCalls: inner.data.toolCalls as AgentMessage['toolCalls'],
                createdAt: Date.now(),
              }],
            }));
          } else if (inner.type === 'tool') {
            set((s) => ({
              agentMessages: [...s.agentMessages, {
                id: inner.data.id,
                role: 'tool',
                content: tag,
                toolResults: inner.data.results as AgentMessage['toolResults'],
                createdAt: Date.now(),
              }],
            }));
          }
          break;
        }
        case 'done':
          set({ agentLoading: false });
          break;
        case 'error':
          set({ agentError: event.data.message, agentLoading: false });
          break;
      }
    });
    activeAbort = { cleanup, sessionId: sid };
  },

  cancelAgent() {
    if (activeAbort) {
      activeAbort.cleanup();
      void window.orisonDesktop.abortAgentRun(activeAbort.sessionId);
    }
    activeAbort = null;
    set({ agentLoading: false });
  },

  async newAgentSession() {
    if (activeAbort) {
      activeAbort.cleanup();
      void window.orisonDesktop.abortAgentRun(activeAbort.sessionId);
    }
    activeAbort = null;
    set({
      agentSessionId: null,
      agentMessages: [],
      agentLoading: false,
      agentError: null,
      pendingToolConfirm: null,
      pendingDiffs: [],
      latestSkillContinuation: null,
      agentContinuations: [],
      restoredSkillContinuation: null,
      continuationSourceSessionId: null,
    });
  },

  async loadAgentSessions() {
    const projectPath = get().currentProject?.path;
    if (!projectPath) { set({ agentSessions: [] }); return; }
    try {
      const sessions = await listAgentSessions(projectPath);
      set({ agentSessions: sessions ?? [] });
    } catch {
      set({ agentSessions: [] });
    }
  },

  async switchAgentSession(sessionId) {
    if (activeAbort) {
      activeAbort.cleanup();
      void window.orisonDesktop.abortAgentRun(activeAbort.sessionId);
    }
    activeAbort = null;
    set({ agentLoading: true, agentError: null });
    try {
      const session = await fetchAgentSession(sessionId);
      if (!session) throw new Error('Session not found');
      set({
        agentSessionId: sessionId,
        agentMessages: (session.messages ?? []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          toolResults: m.toolResults,
          createdAt: m.createdAt,
        })),
        agentLoading: false,
        pendingToolConfirm: null,
        pendingDiffs: [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false });
    }
  },

  async deleteAgentSession(sessionId) {
    try {
      await deleteSession(sessionId);
      set((s) => ({ agentSessions: s.agentSessions.filter((sess) => sess.id !== sessionId) }));
      if (get().agentSessionId === sessionId) {
        set({ agentSessionId: null, agentMessages: [], pendingToolConfirm: null, pendingDiffs: [] });
      }
    } catch { /* ignore */ }
  },
});
