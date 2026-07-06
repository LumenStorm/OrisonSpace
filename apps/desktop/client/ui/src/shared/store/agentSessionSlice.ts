import type { StateCreator } from 'zustand';
import type { ModelRef } from '@orison/shared-contracts';
import type { AgentMode } from './types';
import type { Attachment } from '../types/attachment';
import type { PendingDiff } from './agentDiffSlice';
import { WRITE_TOOLS } from './agentDiffSlice';
import { recoverSelectionAnchorFromMessages } from './passageAnchor';
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
import { registerProjectReset } from './resetRegistry';
import { storage } from './storage';
import { useToastStore } from './toastStore';

const AGENT_MODE_KEY = 'agentMode';
const VALID_MODES: AgentMode[] = ['readonly', 'suggest', 'auto'];
function readPersistedMode(): AgentMode {
  const v = storage.getString(AGENT_MODE_KEY, 'suggest') as AgentMode;
  return VALID_MODES.includes(v) ? v : 'suggest';
}

export type { AgentMessage, AgentSessionMeta };

let activeAbort: { cleanup: () => void; sessionId: string } | null = null;

// Monotonic token guarding model-switch persistence. Rapid A→B→C switches each
// bump it; a late-failing earlier request must not roll the dropdown back over a
// newer selection the user already made.
let modelSwitchToken = 0;

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
  /** Reset all agent conversation state when the active project changes. */
  resetAgentForProjectSwitch: () => void;

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
  pendingDiffs: PendingDiff[];
  pendingToolConfirm: { callId: string; name: string; input: unknown } | null;
  pendingPassageResolve: unknown | null;
  fieldMetadata: Record<string, { version: number } | undefined>;
  setPendingPatch: (patch: import('@orison/shared-contracts').ProjectFieldPatch | null) => void;
};

export const createAgentSessionSlice: StateCreator<Deps, [], [], AgentSessionSlice> = (set, get) => {
  // The agent conversation is keyed to a project path; drop it on switch so
  // messages, session id, model and pending cards can't bleed into the new
  // project. Delegates to the slice's own resetAgentForProjectSwitch action.
  registerProjectReset(() => {
    get().resetAgentForProjectSwitch();
  });

  return {
  agentMode: readPersistedMode(),
  setAgentMode: (mode) => { storage.set(AGENT_MODE_KEY, mode); set({ agentMode: mode }); },
  agentModelRef: null,
  setAgentModelRef: (ref) => {
    const previous = get().agentModelRef;
    set({ agentModelRef: ref });
    // The model is a session-level setting. When a conversation is already
    // open, persist the change so the next turn uses it — without this,
    // switching the dropdown only updated the store and the session kept
    // calling the model it was created with. A brand-new session (no id)
    // carries the selection in via createAgentSession instead.
    //
    // The persist call can be refused (e.g. the session is gone). Await the
    // result and roll the dropdown back on failure so the UI never shows a
    // model the session isn't actually using. A change made while a turn is
    // running is accepted and queued for the next turn (ok === true).
    const state = get();
    if (state.agentSessionId) {
      const token = ++modelSwitchToken;
      void (async () => {
        try {
          const { ok } = await setAgentSessionModel(
            state.agentSessionId!,
            state.currentProject?.path ?? undefined,
            ref,
          );
          // A newer switch superseded this one — its result is authoritative,
          // so neither roll back nor surface an error for the stale request.
          if (token !== modelSwitchToken) return;
          if (!ok) {
            set({ agentModelRef: previous, agentError: 'agent.modelSwitchFailed' });
          }
        } catch {
          if (token !== modelSwitchToken) return;
          set({ agentModelRef: previous, agentError: 'agent.modelSwitchFailed' });
        }
      })();
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

    const messageContent = content;

    let sessionId = state.agentSessionId;
    try {
      if (!sessionId) {
        const session = await createAgentSession(projectPath, state.agentMode, state.agentModelRef);
        sessionId = session.id;
        set({ agentSessionId: sessionId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ agentError: `agent.sessionCreateFailed: ${message}`, agentLoading: false });
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

    // 清除旧 listener。sessionId 过滤保证不同 session 的事件不会串扰，
    // 同 session 的旧 listener 需要清除以防重复接收。
    if (activeAbort) {
      activeAbort.cleanup();
      activeAbort = null;
    }

    const { cleanup, promise } = streamAgentMessage(sid, messageContent, (event: AgentStreamEvent) => {
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
              toolCallId?: string; toolName?: string; toolId?: string; output?: string; metadata?: unknown;
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
                    previousContent?: string | null; existedBefore?: boolean;
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
                const anchor = meta.anchor ?? recoverSelectionAnchorFromMessages(get().agentMessages, originalText, meta.chapterId, meta.filePath);
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
                if (mode !== 'auto') {
                  set((s) => ({
                    pendingDiffs: [...s.pendingDiffs, {
                      kind: 'chapter',
                      id: randomUUID(),
                      toolId,
                      toolCallId: result.toolCallId,
                      fileName: meta.fileName ?? 'unknown',
                      content: meta.content!,
                      chapterId: meta.chapterId,
                      // Snapshot for suggest-mode reject (tool already wrote to disk).
                      previousContent: meta.previousContent,
                      existedBefore: meta.existedBefore,
                      filePath: meta.filePath,
                    }],
                  }));
                }
                // In auto mode the tool already wrote to disk at execution time;
                // the file watcher reconciles any open .md tab, so there is no
                // in-memory chapter view to keep in sync here.
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
        case 'compaction': {
          const { compactedCount } = event.data;
          useToastStore.getState().showToast(
            `上下文已自动压缩，压缩了 ${compactedCount} 条历史消息`,
            'info',
            3000,
          );
          break;
        }
        case 'done':
          if (activeAbort) {
            activeAbort.cleanup();
            activeAbort = null;
          }
          set({ agentLoading: false });
          // stream 结束后与后端对账，补偿可能因 IPC 时序丢失的消息
          void fetchAgentSession(sid).then((session) => {
            if (!session) return;
            const current = get();
            if (current.agentSessionId === sid && session.messages.length > current.agentMessages.length) {
              set({ agentMessages: session.messages });
            }
          });
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

    // Guard against a stream invoke that rejects WITHOUT first emitting an
    // `error` event — otherwise agentLoading would stay true forever (stuck
    // spinner, locked input). Only recover if this run is still the active one,
    // so we don't clobber a newer run the user already started.
    promise.catch((err: unknown) => {
      if (activeAbort?.sessionId !== sid) return;
      const message = err instanceof Error ? err.message : String(err);
      activeAbort.cleanup();
      activeAbort = null;
      set({ agentLoading: false, agentError: message });
    });
  },

  cancelAgent() {
    const abortedSessionId = activeAbort?.sessionId;
    if (activeAbort) {
      activeAbort.cleanup();
      void window.orisonDesktop.abortAgentRun(activeAbort.sessionId);
    }
    activeAbort = null;
    // Clear any cards tied to the aborted run. Leaving them on screen lets the
    // user resolve a confirmation against a run that no longer exists, which
    // flips agentLoading back on and re-strands the spinner.
    set({
      agentLoading: false,
      pendingToolConfirm: null,
      pendingDiffs: [],
      pendingPassageResolve: null,
    });
    // 取消 run 时 listener 已被移除，可能有最后几条已持久化但未推送到 UI 的消息。
    // 从后端重新同步 session 消息以补偿丢失的事件。
    if (abortedSessionId) {
      void fetchAgentSession(abortedSessionId).then((session) => {
        if (!session) return;
        const current = get();
        if (current.agentSessionId === abortedSessionId) {
          set({ agentMessages: session.messages });
        }
      });
    }
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

  resetAgentForProjectSwitch() {
    // The agent session is keyed to a project path. When the active project
    // changes we must drop the previous project's conversation entirely —
    // otherwise its messages, session id, pending diffs and confirmations bleed
    // into the new project, and accepting a stale diff could write to the wrong
    // project's chapters.
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
      agentModelRef: null,
      pendingToolConfirm: null,
      pendingDiffs: [],
      pendingAttachments: [],
      pendingPassageResolve: null,
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
  };
};
