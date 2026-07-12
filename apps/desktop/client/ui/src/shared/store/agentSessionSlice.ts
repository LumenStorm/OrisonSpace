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
  setAgentSessionMode,
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
  const initialMode = readPersistedMode();
  let projectEpoch = 0;
  let sessionListToken = 0;
  let sessionSwitchToken = 0;
  let modelSwitchToken = 0;
  let modeSwitchToken = 0;
  let confirmedMode = initialMode;
  let confirmedModeSessionId: string | null = null;
  let confirmedModelRef: ModelRef | null = null;
  let confirmedModelSessionId: string | null = null;
  let modeSwitchQueue: Promise<void> = Promise.resolve();
  let modelSwitchQueue: Promise<void> = Promise.resolve();

  const isCurrentProjectScope = (epoch: number, projectPath: string | undefined) => (
    projectEpoch === epoch && get().currentProject?.path === projectPath
  );

  // The agent conversation is keyed to a project path; drop it on switch so
  // messages, session id, model and pending cards can't bleed into the new
  // project. Delegates to the slice's own resetAgentForProjectSwitch action.
  registerProjectReset(() => {
    get().resetAgentForProjectSwitch();
  });

  return {
  agentMode: initialMode,
  setAgentMode: (mode) => {
    const state = get();
    if (state.agentLoading && !state.agentSessionId) return;
    storage.set(AGENT_MODE_KEY, mode);
    set({ agentMode: mode });
    const sessionId = state.agentSessionId;
    if (!sessionId) {
      confirmedMode = mode;
      confirmedModeSessionId = null;
      return;
    }
    if (confirmedModeSessionId !== sessionId) {
      confirmedMode = state.agentMode;
      confirmedModeSessionId = sessionId;
    }
    const token = ++modeSwitchToken;
    const epoch = projectEpoch;
    const projectPath = state.currentProject?.path;
    modeSwitchQueue = modeSwitchQueue.then(async () => {
      if (!isCurrentProjectScope(epoch, projectPath) || get().agentSessionId !== sessionId) return;
      try {
        const { ok } = await setAgentSessionMode(sessionId, projectPath, mode);
        if (!isCurrentProjectScope(epoch, projectPath) || get().agentSessionId !== sessionId) return;
        if (ok) {
          confirmedMode = mode;
        } else if (token === modeSwitchToken) {
          storage.set(AGENT_MODE_KEY, confirmedMode);
          set({ agentMode: confirmedMode, agentError: 'agent.modeSwitchFailed' });
        }
      } catch {
        if (
          token === modeSwitchToken
          && isCurrentProjectScope(epoch, projectPath)
          && get().agentSessionId === sessionId
        ) {
          storage.set(AGENT_MODE_KEY, confirmedMode);
          set({ agentMode: confirmedMode, agentError: 'agent.modeSwitchFailed' });
        }
      }
    });
  },
  agentModelRef: null,
  setAgentModelRef: (ref) => {
    const currentState = get();
    if (currentState.agentLoading && !currentState.agentSessionId) return;
    const previous = currentState.agentModelRef;
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
    const sessionId = state.agentSessionId;
    if (!sessionId) {
      confirmedModelRef = ref;
      confirmedModelSessionId = null;
      return;
    }
    if (confirmedModelSessionId !== sessionId) {
      confirmedModelRef = previous;
      confirmedModelSessionId = sessionId;
    }
    const token = ++modelSwitchToken;
    const epoch = projectEpoch;
    const projectPath = state.currentProject?.path;
    modelSwitchQueue = modelSwitchQueue.then(async () => {
      if (!isCurrentProjectScope(epoch, projectPath) || get().agentSessionId !== sessionId) return;
      try {
        const { ok } = await setAgentSessionModel(sessionId, projectPath, ref);
        if (!isCurrentProjectScope(epoch, projectPath) || get().agentSessionId !== sessionId) return;
        if (ok) {
          confirmedModelRef = ref;
        } else if (token === modelSwitchToken) {
          set({ agentModelRef: confirmedModelRef, agentError: 'agent.modelSwitchFailed' });
        }
      } catch {
        if (
          token === modelSwitchToken
          && isCurrentProjectScope(epoch, projectPath)
          && get().agentSessionId === sessionId
        ) {
          set({ agentModelRef: confirmedModelRef, agentError: 'agent.modelSwitchFailed' });
        }
      }
    });
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
    if (!projectPath || state.agentLoading) return;
    const epoch = projectEpoch;
    const isCurrentScope = () => isCurrentProjectScope(epoch, projectPath);
    set({ agentLoading: true, agentError: null });

    // Structured selection/chapter/file references pinned for this turn. They are
    // passed through the IPC channel (not flattened into text); the runtime renders
    // them into the prompt.
    const attachments = state.pendingAttachments;

    const messageContent = content;

    let sessionId = state.agentSessionId;
    try {
      if (!sessionId) {
        const session = await createAgentSession(projectPath, state.agentMode, state.agentModelRef);
        if (!isCurrentScope()) return;
        sessionId = session.id;
        confirmedMode = state.agentMode;
        confirmedModeSessionId = sessionId;
        confirmedModelRef = state.agentModelRef;
        confirmedModelSessionId = sessionId;
        set({ agentSessionId: sessionId });
      }
    } catch (err) {
      if (!isCurrentScope()) return;
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
      if (!isCurrentScope()) return;
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
          void fetchAgentSession(sid, projectPath).then((session) => {
            if (!session || !isCurrentScope()) return;
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
      if (activeAbort?.sessionId !== sid || !isCurrentScope()) return;
      const message = err instanceof Error ? err.message : String(err);
      activeAbort.cleanup();
      activeAbort = null;
      set({ agentLoading: false, agentError: message });
    });
  },

  cancelAgent() {
    const abortedSessionId = activeAbort?.sessionId;
    const projectPath = get().currentProject?.path;
    const epoch = projectEpoch;
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
      void fetchAgentSession(abortedSessionId, projectPath).then((session) => {
        if (!session || !isCurrentProjectScope(epoch, projectPath)) return;
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
    confirmedMode = get().agentMode;
    confirmedModeSessionId = null;
    confirmedModelRef = get().agentModelRef;
    confirmedModelSessionId = null;
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
    projectEpoch += 1;
    sessionListToken += 1;
    sessionSwitchToken += 1;
    modelSwitchToken += 1;
    modeSwitchToken += 1;
    confirmedMode = get().agentMode;
    confirmedModeSessionId = null;
    confirmedModelRef = null;
    confirmedModelSessionId = null;
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
      agentSessions: [],
    });
  },

  async loadAgentSessions() {
    const projectPath = get().currentProject?.path;
    if (!projectPath) { set({ agentSessions: [] }); return; }
    const epoch = projectEpoch;
    const token = ++sessionListToken;
    try {
      const sessions = await listAgentSessions(projectPath);
      if (token !== sessionListToken || !isCurrentProjectScope(epoch, projectPath)) return;
      set({ agentSessions: sessions ?? [] });
    } catch {
      if (token !== sessionListToken || !isCurrentProjectScope(epoch, projectPath)) return;
      set({ agentSessions: [] });
    }
  },

  async switchAgentSession(sessionId) {
    const projectPath = get().currentProject?.path;
    if (!projectPath) return;
    const epoch = projectEpoch;
    const token = ++sessionSwitchToken;
    if (activeAbort) {
      activeAbort.cleanup();
      void window.orisonDesktop.abortAgentRun(activeAbort.sessionId);
    }
    activeAbort = null;
    set({ agentLoading: true, agentError: null });
    try {
      const session = await fetchAgentSession(sessionId, projectPath);
      if (token !== sessionSwitchToken || !isCurrentProjectScope(epoch, projectPath)) return;
      if (!session) throw new Error('Session not found');
      const permissionMode = session.permissionMode ?? 'suggest';
      storage.set(AGENT_MODE_KEY, permissionMode);
      confirmedMode = permissionMode;
      confirmedModeSessionId = sessionId;
      confirmedModelRef = session.modelRef ?? null;
      confirmedModelSessionId = sessionId;
      set({
        agentSessionId: sessionId,
        agentModelRef: session.modelRef ?? null,
        agentMode: permissionMode,
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
      if (token !== sessionSwitchToken || !isCurrentProjectScope(epoch, projectPath)) return;
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false });
    }
  },

  async deleteAgentSession(sessionId) {
    const projectPath = get().currentProject?.path;
    const epoch = projectEpoch;
    try {
      const deleted = await deleteSession(sessionId, projectPath);
      if (!isCurrentProjectScope(epoch, projectPath)) return;
      if (!deleted) return;
      set((s) => ({ agentSessions: s.agentSessions.filter((sess) => sess.id !== sessionId) }));
      if (get().agentSessionId === sessionId) {
        set({ agentSessionId: null, agentMessages: [], pendingToolConfirm: null, pendingDiffs: [] });
      }
    } catch { /* ignore */ }
  },
  };
};
