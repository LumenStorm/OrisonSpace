import type { StateCreator } from 'zustand';
import type { ModelRef } from '@orison/shared-contracts';
import type { AgentMode } from './types';
import {
  createAgentSession,
  executeAgentSkill,
  fetchAgentSession,
  deleteAgentSession as deleteSession,
  listAgentContinuations,
  listAgentSkills,
  listAgentSessions,
  restoreAgentContinuation as restoreAgentContinuationApi,
  resolveAgentConfirmation,
  streamAgentMessage,
  type AgentContinuation,
  type AgentContinuationListItem,
  type AgentContinuationRestoreResponse,
  type AgentContinuationRestoreState,
  type AgentMessage,
  type AgentSessionMeta,
  type AgentSkillInfo,
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

  agentSkills: AgentSkillInfo[];
  agentSkillError: string | null;
  latestSkillContinuation: AgentContinuation | null;
  agentContinuations: AgentContinuationListItem[];
  restoredSkillContinuation: AgentContinuationRestoreState | null;
  continuationSourceSessionId: string | null;
  loadAgentSkills: () => Promise<void>;
  loadAgentContinuations: (sessionIdOverride?: string | null) => Promise<void>;
  runAgentSkill: (skillName: string) => Promise<void>;
  restoreLatestSkillContinuation: () => Promise<void>;
  rerunLatestSkillContinuation: () => Promise<void>;
  restoreAgentContinuation: (continuationId: string) => Promise<void>;

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
  agentSkills: [],
  agentSkillError: null,
  latestSkillContinuation: null,
  agentContinuations: [],
  restoredSkillContinuation: null,
  continuationSourceSessionId: null,

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
  },

  cancelAgent() {
    activeAbort?.abort();
    activeAbort = null;
    set({ agentLoading: false });
  },

  async newAgentSession() {
    activeAbort?.abort();
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

  async loadAgentSkills() {
    const projectPath = get().currentProject?.path;
    if (!projectPath) {
      set({ agentSkills: [], agentSkillError: null });
      return;
    }
    try {
      const skills = await listAgentSkills(projectPath);
      set({ agentSkills: skills, agentSkillError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentSkillError: message, agentSkills: [] });
    }
  },

  async loadAgentContinuations(sessionIdOverride) {
    const sessionId = sessionIdOverride ?? get().continuationSourceSessionId ?? get().agentSessionId;
    if (!sessionId) {
      set({ agentContinuations: [] });
      return;
    }
    try {
      const continuations = await listAgentContinuations(sessionId);
      set({ agentContinuations: continuations, continuationSourceSessionId: sessionId });
    } catch {
      set({ agentContinuations: [] });
    }
  },

  async runAgentSkill(skillName) {
    const state = get();
    const projectPath = state.currentProject?.path;
    if (!projectPath) return;

    let sessionId = state.agentSessionId;
    if (!sessionId) {
      const session = await createAgentSession(projectPath, state.agentMode, state.agentModelRef);
      sessionId = session.id;
      set({ agentSessionId: sessionId });
    }

    set({ agentLoading: true, agentError: null });
    try {
      const result = await executeAgentSkill(sessionId, skillName);
      const assistantMsg: AgentMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: result.outputs.join('\n\n') || `Skill "${skillName}" completed.`,
        createdAt: Date.now(),
      };
      set((s) => ({
        agentMessages: [...s.agentMessages, assistantMsg],
        latestSkillContinuation: result.continuation ?? null,
        restoredSkillContinuation: null,
        continuationSourceSessionId: sessionId,
        agentLoading: false,
      }));
      await get().loadAgentContinuations(sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false });
    }
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
      set({
        agentSessionId: sessionId,
        agentMessages: data.messages,
        agentLoading: false,
        agentError: null,
        continuationSourceSessionId: sessionId,
      });
      await get().loadAgentContinuations(sessionId);
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
    void resolveAgentConfirmation(sessionId, pending.callId, true);
  },

  async restoreLatestSkillContinuation() {
    const continuation = get().latestSkillContinuation;
    if (!continuation?.continuationId) return;
    await get().restoreAgentContinuation(continuation.continuationId);
  },

  async rerunLatestSkillContinuation() {
    const state = get();
    const continuation = state.latestSkillContinuation;
    if (!continuation?.workflowState.activeSkill) return;

    let sessionId = state.agentSessionId;
    if (!sessionId) {
      const projectPath = state.currentProject?.path;
      if (!projectPath) return;
      const session = await createAgentSession(projectPath, state.agentMode, state.agentModelRef);
      sessionId = session.id;
      set({ agentSessionId: sessionId });
    }

    set({ agentLoading: true, agentError: null });
    try {
      const result = await executeAgentSkill(sessionId, continuation.workflowState.activeSkill, {
        input: continuation.compacted.summary || undefined,
      });
      const assistantMsg: AgentMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: result.outputs.join('\n\n') || `Skill "${continuation.workflowState.activeSkill}" completed.`,
        createdAt: Date.now(),
      };
      set((s) => ({
        agentMessages: [...s.agentMessages, assistantMsg],
        latestSkillContinuation: result.continuation ?? continuation,
        restoredSkillContinuation: {
          sourceSessionId: continuation.sessionId,
          sessionId: continuation.sessionId,
          summary: continuation.compacted.summary,
          tail: continuation.compacted.tail,
          workflowState: continuation.workflowState,
        },
        continuationSourceSessionId: sessionId,
        agentLoading: false,
      }));
      await get().loadAgentContinuations(sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false });
    }
  },

  async restoreAgentContinuation(continuationId) {
    const sessionId = get().agentSessionId;
    if (!sessionId) return;
    set({ agentLoading: true, agentError: null });
    try {
      const result: AgentContinuationRestoreResponse = await restoreAgentContinuationApi(sessionId, continuationId);
      const restored = result.restored;
      const sourceSessionId = restored.sourceSessionId;
      set({
        agentSessionId: restored.session.id,
        agentMessages: restored.tail.map((item) => ({
          id: item.id,
          role: item.role as AgentMessage['role'],
          content: item.content,
          createdAt: item.createdAt,
        })),
        restoredSkillContinuation: {
          sourceSessionId,
          sessionId: restored.session.id,
          summary: restored.summary,
          tail: restored.tail,
          workflowState: restored.workflowState,
        },
        continuationSourceSessionId: sourceSessionId,
        agentLoading: false,
        agentError: null,
      });
      await get().loadAgentContinuations(sourceSessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false });
    }
  },
  rejectPendingTool() {
    const pending = get().pendingToolConfirm;
    const sessionId = get().agentSessionId;
    if (!pending || !sessionId) return;
    set({ pendingToolConfirm: null, agentLoading: true });
    void resolveAgentConfirmation(sessionId, pending.callId, false);
  },
});
