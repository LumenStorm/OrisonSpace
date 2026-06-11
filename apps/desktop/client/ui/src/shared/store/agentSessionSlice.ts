import type { StateCreator } from 'zustand';
import type { ModelRef } from '@orison/shared-contracts';
import type { AgentMode } from './types';
import type { Attachment, SelectionAnchor } from '../types/attachment';
import type { PendingDiff } from './agentDiffSlice';
import { WRITE_TOOLS } from './agentDiffSlice';
import {
  createAgentSession,
  fetchAgentSession,
  setAgentSessionModel,
  deleteAgentSession as deleteSession,
  listAgentSessions,
  streamAgentMessage,
  type AgentMessage,
  type AgentSessionMeta,
  type AgentStreamEvent,
} from '../api/agent';
import { randomUUID } from '../util/id';

export type { AgentMessage, AgentSessionMeta };

/**
 * The runtime echoes passage metadata without the original `SelectionAnchor`
 * (the anchor is UI-captured and never round-trips through the LLM tool call).
 * Recover it from the session's sent selection references so passage relocation
 * can use prefix/suffix context to disambiguate duplicate matches. Most recent
 * matching selection wins. Match on the exact quote, scoped to the same source.
 */
function recoverAnchor(
  messages: AgentMessage[],
  originalText: string,
  chapterId: string | undefined,
  filePath: string | undefined,
): SelectionAnchor | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const refs = messages[i].references;
    if (!refs) continue;
    for (const ref of refs) {
      if (ref.type !== 'selection') continue;
      const sameSource = chapterId ? ref.chapterId === chapterId : filePath ? ref.filePath === filePath : true;
      if (!sameSource) continue;
      if (ref.anchor.quote === originalText || ref.text === originalText) return ref.anchor;
    }
  }
  return undefined;
}

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

  pendingAttachments: Attachment[];
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

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
  pendingDiffs: PendingDiff[];
  pendingToolConfirm: { callId: string; name: string; input: unknown } | null;
  fieldMetadata: Record<string, { version: number } | undefined>;
  setPendingPatch: (patch: import('@orison/shared-contracts').ProjectFieldPatch | null) => void;
};

export const createAgentSessionSlice: StateCreator<Deps, [], [], AgentSessionSlice> = (set, get) => ({
  agentMode: 'suggest',
  setAgentMode: (mode) => set({ agentMode: mode }),
  agentModelRef: null,
  setAgentModelRef: (ref) => {
    set({ agentModelRef: ref });
    // The model is a session-level setting. When a conversation is already
    // open and idle, persist the change so the next turn uses it — without
    // this, switching the dropdown only updated the store and the session
    // kept calling the model it was created with. A brand-new session (no id)
    // carries the selection in via createAgentSession instead.
    const state = get();
    if (state.agentSessionId && !state.agentLoading) {
      void setAgentSessionModel(state.agentSessionId, state.currentProject?.path ?? undefined, ref);
    }
  },

  agentSessionId: null,
  agentMessages: [],
  agentLoading: false,
  agentError: null,

  pendingAttachments: [],
  addAttachment: (attachment) =>
    set((s) => (
      s.pendingAttachments.some((a) => a.id === attachment.id && a.type === attachment.type)
        ? s
        : { pendingAttachments: [...s.pendingAttachments, attachment] }
    )),
  removeAttachment: (id) =>
    set((s) => ({ pendingAttachments: s.pendingAttachments.filter((a) => a.id !== id) })),
  clearAttachments: () => set({ pendingAttachments: [] }),

  agentSessions: [],

  async sendAgentMessage(content) {
    const state = get();
    const projectPath = state.currentProject?.path;
    if (!projectPath) return;

    // Structured selection/chapter/file references pinned for this turn. They are
    // passed through the IPC channel (not flattened into text); the runtime renders
    // them into the prompt.
    const attachments = state.pendingAttachments;

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
      references: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };
    set((s) => ({
      agentMessages: [...s.agentMessages, userMsg],
      agentLoading: true,
      agentError: null,
      pendingAttachments: [],
    }));

    const sid = sessionId;
    const mode = state.agentMode;

    // Clean up previous stream listener to prevent duplication
    if (activeAbort) {
      activeAbort.cleanup();
      activeAbort = null;
    }

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
            // The agent emits ToolCallResult with `toolName`; older shapes used `toolId`.
            const results = event.data.results as Array<{
              toolName?: string; toolId?: string; output?: string; metadata?: unknown;
            }>;
            // Structured field patches (outline_update / overview_update) accumulate
            // across this result batch, then surface once in the patch-review panel.
            const fieldPatchEntries: import('@orison/shared-contracts').FieldPatchEntry[] = [];
            for (const result of results) {
              const toolId = result.toolName ?? result.toolId ?? '';
              if (!WRITE_TOOLS.includes(toolId)) continue;

              const meta = result.metadata as
                | {
                    type?: string;
                    fileName?: string; content?: string; chapterId?: string;
                    filePath?: string; replacement?: string; originalText?: string; originalQuote?: string;
                    field?: string; action?: string; data?: unknown;
                    anchor?: import('../types/attachment').SelectionAnchor;
                  }
                | undefined;
              if (!meta) continue;

              // Structured field patch (outline / overview): route to the
              // patch-review flow instead of applying or building a text diff.
              if (meta.type === 'field_patch' && meta.field) {
                const action = (meta.action === 'merge' || meta.action === 'delete') ? meta.action : 'set';
                const currentVersion = get().fieldMetadata[meta.field]?.version ?? 0;
                fieldPatchEntries.push({
                  field: meta.field as import('@orison/shared-contracts').FieldPatchEntry['field'],
                  action,
                  data: meta.data,
                  fieldVersion: currentVersion + 1,
                  generatedBy: toolId,
                });
                continue;
              }

              // Passage-level rewrite: never auto-apply blindly; build a passage diff.
              if (meta.type === 'passage') {
                const sourceType: 'chapter' | 'file' = meta.chapterId ? 'chapter' : 'file';
                const originalText = meta.originalText ?? meta.originalQuote ?? meta.anchor?.quote ?? '';
                if (!originalText || meta.replacement == null) continue;
                // Backfill the anchor from the sent selection when the runtime omits it,
                // so passage relocation can disambiguate duplicate matches.
                const anchor = meta.anchor ?? recoverAnchor(get().agentMessages, originalText, meta.chapterId, meta.filePath);
                set((s) => ({
                  pendingDiffs: [...s.pendingDiffs, {
                    kind: 'passage',
                    id: randomUUID(),
                    toolId,
                    sourceType,
                    chapterId: meta.chapterId,
                    filePath: meta.filePath,
                    originalText,
                    replacement: meta.replacement!,
                    anchor,
                  }],
                }));
                continue;
              }

              // Whole-chapter rewrite.
              if (meta.content) {
                if (mode === 'auto') {
                  const currentState = get();
                  const chapter = currentState.chapters.find((c) =>
                    meta.chapterId ? c.id === meta.chapterId : c.title.includes((meta.fileName ?? '').replace('.md', '')),
                  );
                  if (chapter) {
                    currentState.updateChapter(chapter.id, { content: meta.content });
                  }
                } else {
                  set((s) => ({
                    pendingDiffs: [...s.pendingDiffs, {
                      kind: 'chapter',
                      id: randomUUID(),
                      toolId,
                      fileName: meta.fileName ?? 'unknown',
                      content: meta.content!,
                      chapterId: meta.chapterId,
                    }],
                  }));
                }
              }
            }

            // Surface accumulated structured patches for review. Merge with any
            // pending patch from a prior batch in this run so none are dropped.
            if (fieldPatchEntries.length > 0) {
              get().setPendingPatch({
                runId: get().agentSessionId ?? randomUUID(),
                createdAt: new Date().toISOString(),
                patches: fieldPatchEntries,
              });
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
          if (activeAbort) {
            activeAbort.cleanup();
            activeAbort = null;
          }
          set({ agentLoading: false });
          break;
        case 'error':
          if (activeAbort) {
            activeAbort.cleanup();
            activeAbort = null;
          }
          set({ agentError: event.data.message, agentLoading: false });
          break;
      }
    }, attachments);
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
      pendingAttachments: [],
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
      const projectPath = get().currentProject?.path;
      const session = await fetchAgentSession(sessionId, projectPath ?? undefined);
      if (!session) throw new Error('Session not found');
      set({
        agentSessionId: sessionId,
        agentModelRef: session.modelRef ?? null,
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
