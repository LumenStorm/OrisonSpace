import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createSession, getSession, deleteSession, addMessage, updateStatus, loadSession, updateSessionModelRef } from '../agent/session';
import { listSessions, persistContinuation, loadContinuations, loadContinuationById, overwriteMessagesFile, persistSession } from '../agent/persistence';
import { runLoop } from '../agent/loop';
import { loadAgentDefinition } from '../agent/agentDefinitions';
import { generate } from '../provider/ipc-provider';
import { registry } from '../tool/registry';
import { buildSystemPrompt } from '../prompt/render';
import { discoverSkills } from '../skill/discovery';
import { SkillRegistry } from '../skill/runtime/registry';
import { createWorkflowExecutor, type WorkflowExecutionContext, type WorkflowExecutionResult } from '../skill/runtime/workflowExecutor';
import { loadSkillFromDir } from '../skill/loadSkillFromDir';
import { loadRuntimeConfig } from './config';
import { InMemoryArtifactStore, type ArtifactStore } from '../artifact/store';
import { buildSkillContext, type SkillRuntimeContext } from '../context/builder';
import { compactConversation, type CompactedConversation } from '../context/compaction';
import { createContinuationSnapshot, restoreContinuationSnapshot, type ContinuationSnapshot } from '../context/continuation';
import { logger } from '../logger';
import { getDefaultRunStateStore, RunStateStore, SessionRunAlreadyActiveError, type RunCheckpoint, type RunStateSnapshot } from './runState';
import { createPermissionService, type PermissionService } from './permission';
import { createSubagentRuntime, type SubagentRuntime, type SubagentDispatchInput, type SubagentDispatchOutput } from './subagent';
import { forkSession } from './sessionTree';
import { createSkillContinuation, mergeConversationSummaryWithRunState, restoreSkillContinuation } from './skillContinuation';
import { serializeSkillRunState, type SkillRunState } from './skillRunState';
import type { ResolvedReferencePayload } from '../skill/runtime/referenceResolver';
import {
  MAX_SPAWN_DEPTH,
  SpawnDepthExceededError,
  type ChildInnerEvent,
  type ChildStreamEvent,
  type ConfirmationResolution,
  type PendingConfirmationState,
  type RuntimeStreamEvent,
  type SessionMessage,
  type SessionState,
  type SkillExecutorInvokeOptions,
} from '../types';

export interface CreateSessionInput {
  agentName: string;
  projectPath: string;
  modelRef?: { keyId: string; modelId: string };
}

/**
 * Anchor describing a selected passage's location for later relocation.
 * Mirrors the UI-side `SelectionAnchor`.
 */
export interface MessageSelectionAnchor {
  quote: string;
  prefix: string;
  suffix: string;
  rangeHint: { from: number; to: number };
}

/**
 * A structured attachment carried on a message (not a file reference).
 * Selection attachments carry the quoted passage plus its source + anchor so the
 * runtime can render a structured reference block for the LLM. Chapter/file
 * attachments are lightweight pointers used as conversational context.
 */
export type MessageAttachment =
  | { type: 'chapter'; id: string; label: string }
  | { type: 'file'; id: string; label: string }
  | {
      type: 'selection';
      id: string;
      label: string;
      text: string;
      sourceType: 'chapter' | 'file';
      chapterId?: string;
      filePath?: string;
      anchor: MessageSelectionAnchor;
    };

export interface SendMessageInput {
  sessionId: string;
  content: string;
  abortSignal: AbortSignal;
  attachments?: MessageAttachment[];
}

export interface StreamMessageInput extends SendMessageInput {
  sendEvent: (event: RuntimeStreamEvent) => void;
}

export interface ExecuteSkillRequest {
  input?: string;
  artifactIds?: string[];
  referenceIds?: string[];
}

export interface ExecuteSkillResponse extends WorkflowExecutionResult {
  continuation: ContinuationSnapshot & { continuationId: string };
}

export interface ContinuationSummary {
  continuationId: string;
  sessionId: string;
  createdAt: number;
  summary: string;
  workflowState: {
    activeSkill?: string;
    checkpoints: string[];
    currentNodeId?: string;
    skillRunState?: ContinuationSnapshot['workflowState']['skillRunState'];
  };
}

export interface RestoredContinuationResponse {
  sourceSessionId: string;
  continuationId: string;
  session: SessionState;
  summary: string;
  tail: SessionMessage[];
  workflowState: {
    activeSkill?: string;
    checkpoints: string[];
    currentNodeId?: string;
    skillRunState?: ContinuationSnapshot['workflowState']['skillRunState'];
  };
}

export interface WorkflowRuntime {
  createSession(input: CreateSessionInput): SessionState;
  getSession(id: string, projectPath?: string): SessionState | undefined;
  setSessionModel(id: string, modelRef: { keyId: string; modelId: string } | undefined): boolean;
  listSessions(projectPath?: string): { sessions: ReturnType<typeof listSessions> };
  deleteSession(id: string): boolean;
  getRunState(sessionId: string): RunStateSnapshot | undefined;
  abortRun(sessionId: string): boolean;
  resumeRun(sessionId: string): RunCheckpoint | undefined;
  registerPendingConfirmation(sessionId: string, toolName: string, input: unknown): PendingConfirmationState;
  getPendingConfirmation(sessionId: string): PendingConfirmationState | undefined;
  resolveConfirmation(sessionId: string, callId: string, approved: boolean): ConfirmationResolution;
  dispatchSubagent(input: SubagentDispatchInput): Promise<SubagentDispatchOutput>;
  runSubagent(parentSessionId: string, role: string, prompt: string, options?: SkillExecutorInvokeOptions): Promise<{ content: string }>;
  loadSkillsForSession(sessionId: string): Promise<string[]>;
  listSkills(projectPath: string): Promise<Array<{ name: string; description?: string; location: string; format: string; source?: 'project' | 'external'; capabilities: string[] }>>;
  listContinuations(sessionId: string): ContinuationSummary[];
  restoreContinuation(sessionId: string, continuationId: string): RestoredContinuationResponse;
  executeSkill(skillName: string, context: WorkflowExecutionContext): Promise<WorkflowExecutionResult>;
  executeSkillByName(sessionId: string, skillName: string, request?: string | ExecuteSkillRequest, options?: SkillExecutorInvokeOptions): Promise<ExecuteSkillResponse>;
  buildSkillContext(sessionId: string, skillNameOrArtifactIds?: string | string[], artifactIdsOrReferenceIds?: string[], referenceIds?: string[]): SkillRuntimeContext;
  compactSession(sessionId: string, preserveLast?: number, skillRunState?: SkillRunState): CompactedConversation;
  createContinuationSnapshot(sessionId: string, workflowState: { activeSkill?: string; checkpoints: string[]; currentNodeId?: string; skillRunState?: SkillRunState }): ContinuationSnapshot;
  restoreContinuationSnapshot(snapshot: ContinuationSnapshot): ReturnType<typeof restoreContinuationSnapshot>;
  sendMessage(input: SendMessageInput): Promise<{ messages: SessionMessage[] }>;
  streamMessage(input: StreamMessageInput): Promise<void>;
}

const DEFAULT_ORISON_PROMPT = 'You are Orison, an AI writing assistant for creative fiction.';

export interface WorkflowRuntimeOptions {
  generate?: typeof generate;
  runState?: RunStateStore;
  permission?: PermissionService;
  subagents?: SubagentRuntime;
  skillRegistry?: SkillRegistry;
  externalSkillRoots?: string[];
  artifactStore?: ArtifactStore;
}

export function createWorkflowRuntime(options: WorkflowRuntimeOptions = {}): WorkflowRuntime {
  const generateImpl = options.generate ?? generate;
  const runState = options.runState ?? getDefaultRunStateStore();
  const permission = options.permission ?? createPermissionService();
  let subagents = options.subagents;
  const skillRegistry = options.skillRegistry ?? new SkillRegistry();
  const externalSkillRoots = options.externalSkillRoots ?? [];
  const artifactStore = options.artifactStore ?? new InMemoryArtifactStore();

  const runChildAgent = async (
    childSession: SessionState,
    role: string,
    taskPrompt: string,
    options: {
      abort: AbortSignal;
      spawnDepth: number;
      emitChildEvent?: (event: ChildStreamEvent) => void;
      source: 'subagent' | 'skill';
    },
  ): Promise<{ content: string }> => {
    if (options.spawnDepth > MAX_SPAWN_DEPTH) {
      throw new SpawnDepthExceededError(options.spawnDepth);
    }
    const agentDefinition = await loadAgentDefinition({
      projectPath: childSession.projectPath,
      role,
      extraRoots: externalSkillRoots,
    });
    const baseSystemPrompt = await buildRuntimeSystemPrompt(childSession, externalSkillRoots);
    const systemPrompt = agentDefinition?.systemPrompt
      ? `${agentDefinition.systemPrompt}\n\n---\n${baseSystemPrompt}`
      : baseSystemPrompt;
    const roleHeader = agentDefinition
      ? `You are the **${role}** agent.${agentDefinition.description ? ` ${agentDefinition.description}` : ''}`
      : `You are acting as the **${role}** subagent. Complete the task focused, then return your final answer.`;
    const enrichedPrompt = `${roleHeader}\n\n${taskPrompt}`;
    const childOnMessage = makeChildOnMessage(options.source, role, childSession.id, options.spawnDepth, options.emitChildEvent);
    const messages = await runLoop({
      sessionId: childSession.id,
      projectPath: childSession.projectPath,
      messages: [{
        id: randomUUID(),
        role: 'user',
        content: enrichedPrompt,
        createdAt: Date.now(),
      }],
      systemPrompt,
      tools: registry.all(),
      maxSteps: 30,
      generate: (msgs, sys, tls, abortSignal) => generateImpl(msgs, sys, tls, abortSignal, { modelRef: childSession.modelRef }),
      onMessage: childOnMessage,
      abort: options.abort,
      skillExecutor: runtime,
      spawnDepth: options.spawnDepth,
      emitChildEvent: options.emitChildEvent,
    });
    const content = messages
      .filter((m) => m.role === 'assistant')
      .map((m) => m.content)
      .filter((c) => c && c.trim().length > 0)
      .join('\n\n');
    return { content };
  };

  const skillExecutor = createWorkflowExecutor({
    registry: skillRegistry,
    executePrompt: async (prompt, skill, context) => {
      const session = getSession(context.sessionId);
      if (!session) {
        throw new Error('session not found');
      }
      const depth = (context.spawnDepth ?? 0) + 1;
      if (depth > MAX_SPAWN_DEPTH) {
        throw new SpawnDepthExceededError(depth);
      }
      const tree = await getProjectTree(session.projectPath);
      // Inject any reference files the workflow already resolved (load_reference
      // nodes run before the instruction node's executePrompt on the same phase).
      // Without this the reference content was loaded into run-state and dropped,
      // so the model never saw it — the cause of "skill can't read _reference".
      const referenceBlock = buildReferenceBlock(context.skillContext?.resolvedReferences);
      const promptWithRefs = referenceBlock ? `${prompt}\n\n${referenceBlock}` : prompt;
      const content = context.input
        ? `${promptWithRefs}\n\nProject file structure:\n${tree}\n\nUser request:\n${context.input}`
        : `${promptWithRefs}\n\nProject file structure:\n${tree}`;
      const systemPrompt = await buildRuntimeSystemPrompt(session, externalSkillRoots);
      const childOnMessage = makeChildOnMessage('skill', skill.name, session.id, depth, context.emitChildEvent);
      const availableTools = context.suppressAllTools
        ? []
        : (() => {
          let tools = registry.all();
          if (context.suppressSpawnAgent) {
            tools = tools.filter((t) => t.id !== 'spawn_agent');
          }
          if (context.suppressWriteTools) {
            tools = tools.filter((t) => t.id !== 'write_file' && t.id !== 'chapter_write');
          }
          return tools;
        })();
      const messages = await runLoop({
        sessionId: context.sessionId,
        projectPath: session.projectPath,
        messages: [{
          id: randomUUID(),
          role: 'user',
          content,
          createdAt: Date.now(),
        }],
        systemPrompt,
        tools: availableTools,
        maxSteps: 30,
        generate: (msgs, sys, tls, abortSignal) => generateImpl(msgs, sys, tls, abortSignal, { modelRef: session.modelRef }),
        onMessage: childOnMessage,
        abort: context.abort ?? new AbortController().signal,
        skillExecutor: runtime,
        spawnDepth: depth,
        emitChildEvent: context.emitChildEvent,
      });
      const assistantContent = messages
        .filter((m) => m.role === 'assistant')
        .map((m) => m.content)
        .filter((c) => c && c.trim().length > 0)
        .join('\n\n');
      return assistantContent;
    },
    executeTool: async (toolName, input) => {
      const tool = registry.get(toolName);
      if (!tool) {
        throw new Error(`tool "${toolName}" not found`);
      }
      const result = await tool.execute(input, {
        sessionId: 'workflow-skill',
        projectPath: '.',
        abort: new AbortController().signal,
      });
      return result.output;
    },
    requestConfirmation: async (toolName, input, context) => ({
      approved: true,
      pending: runtime.registerPendingConfirmation(context.sessionId, toolName, input),
    }),
    dispatchAgent: async (agentType, prompt, context) => {
      const depth = (context.spawnDepth ?? 0) + 1;
      const abort = context.abort ?? new AbortController().signal;
      const emitChildEvent = context.emitChildEvent;
      const dispatched = await runtime.dispatchSubagent({
        parentSessionId: context.sessionId,
        role: agentType,
        prompt,
        complete: async ({ session: childSession, prompt: taskPrompt, role }) => {
          return runChildAgent(childSession, role, taskPrompt, {
            abort,
            spawnDepth: depth,
            emitChildEvent,
            source: 'subagent',
          });
        },
      });
      return {
        content: dispatched.result.content,
        status: dispatched.result.status,
      };
    },
  });

  const runtime: WorkflowRuntime = {
    createSession(input) {
      return createSession(input.agentName, input.projectPath, input.modelRef);
    },

    getSession(id, projectPath) {
      return getSession(id) ?? (projectPath ? loadSession(id, projectPath) : undefined);
    },

    setSessionModel(id, modelRef) {
      const session = getSession(id);
      if (!session) return false;
      // Refuse to swap the model into an in-flight generate call. Instead of
      // silently dropping the change, queue it so the next turn picks it up.
      if (session.status === 'running') {
        session.pendingModelRef = modelRef ?? null;
        return true;
      }
      session.pendingModelRef = undefined;
      updateSessionModelRef(id, modelRef);
      return true;
    },

    listSessions(projectPath) {
      if (!projectPath) return { sessions: [] };
      return { sessions: listSessions(projectPath) };
    },

    deleteSession(id) {
      return deleteSession(id);
    },

    getRunState(sessionId) {
      return runState.getSnapshot(sessionId);
    },

    abortRun(sessionId) {
      return runState.abortRun(sessionId);
    },

    resumeRun(sessionId) {
      return runState.resumeRun(sessionId);
    },

    registerPendingConfirmation(sessionId, toolName, input) {
      const result = permission.evaluate({ sessionId, toolName, input });
      if (result.action !== 'ask') {
        throw new Error(`tool "${toolName}" did not produce a pending confirmation`);
      }
      return result.pending;
    },

    getPendingConfirmation(sessionId) {
      return permission.getPending(sessionId);
    },

    resolveConfirmation(sessionId, callId, approved) {
      return permission.resolvePending(sessionId, callId, approved);
    },

    async dispatchSubagent(input) {
      if (!subagents) {
        subagents = createSubagentRuntime({
          runtime,
          narrowPermission: () => permission,
        });
      }
      return subagents.dispatch(input);
    },

    async runSubagent(parentSessionId, role, prompt, options) {
      const abort = options?.abort ?? new AbortController().signal;
      const spawnDepth = (options?.spawnDepth ?? 0) + 1;
      const emitChildEvent = options?.emitChildEvent;
      const dispatched = await runtime.dispatchSubagent({
        parentSessionId,
        role,
        prompt,
        complete: async ({ session: childSession, prompt: taskPrompt, role: childRole }) => {
          return runChildAgent(childSession, childRole, taskPrompt, {
            abort,
            spawnDepth,
            emitChildEvent,
            source: 'subagent',
          });
        },
      });
      return { content: dispatched.result.content };
    },

    async loadSkillsForSession(sessionId) {
      const session = getSession(sessionId);
      if (!session) {
        throw new Error('session not found');
      }
      const runtimeConfig = await loadRuntimeConfig(session.projectPath);
      const loaded = await loadProjectSkills(skillRegistry, session.projectPath, [
        ...externalSkillRoots,
        ...runtimeConfig.externalSkillRoots,
      ]);
      return loaded.map((skill) => skill.name);
    },

    async listSkills(projectPath) {
      const runtimeConfig = await loadRuntimeConfig(projectPath);
      const runtimeRegistry = new SkillRegistry();
      const loaded = await loadProjectSkills(runtimeRegistry, projectPath, [
        ...externalSkillRoots,
        ...runtimeConfig.externalSkillRoots,
      ]);
      return loaded.map((skill) => ({
        name: skill.name,
        description: skill.description,
        location: skill.location,
        format: skill.format,
        source: skill.source,
        capabilities: skill.capabilities ?? [],
      }));
    },

    async executeSkill(skillName, context) {
      return skillExecutor.executeSkill(skillName, context);
    },

    async executeSkillByName(sessionId, skillName, request, options) {
      await runtime.loadSkillsForSession(sessionId);
      const normalized = typeof request === 'string'
        ? { input: request }
        : (request ?? {});
      const skillContext = runtime.buildSkillContext(
        sessionId,
        skillName,
        normalized.artifactIds,
        normalized.referenceIds,
      );

      for (const artifactId of normalized.artifactIds ?? []) {
        artifactStore.attachToRun(artifactId, sessionId);
      }
      for (const referenceId of normalized.referenceIds ?? []) {
        artifactStore.attachToRun(referenceId, sessionId);
      }

      const result = await runtime.executeSkill(skillName, {
        sessionId,
        input: normalized.input,
        skillContext,
        abort: options?.abort,
        spawnDepth: options?.spawnDepth ?? 0,
        emitChildEvent: options?.emitChildEvent,
      });
      const session = getSession(sessionId);
      if (session) {
        session.skillRunState = serializeSkillRunState(result.skillRunState);
        persistSession(session);
      }
      const continuation = runtime.createContinuationSnapshot(sessionId, {
        activeSkill: skillName,
        checkpoints: result.checkpoints,
        currentNodeId: result.skillRunState?.currentNodeId,
        skillRunState: result.skillRunState,
      });
      const continuationId = randomUUID();
      if (session) {
        persistContinuation(session.projectPath, {
          continuationId,
          sessionId,
          createdAt: Date.now(),
          snapshot: continuation,
        });
      }
      return {
        ...result,
        continuation: {
          ...continuation,
          continuationId,
        },
      };
    },

    listContinuations(sessionId) {
      const session = getSession(sessionId);
      if (!session) {
        throw new Error('session not found');
      }
      return loadContinuations(session.projectPath, sessionId).map((item) => ({
        continuationId: item.continuationId,
        sessionId: item.sessionId,
        createdAt: item.createdAt,
        summary: item.snapshot.compacted.summary,
        workflowState: item.snapshot.workflowState,
      }));
    },

    restoreContinuation(sessionId, continuationId) {
      const session = getSession(sessionId);
      if (!session) {
        throw new Error('session not found');
      }
      const record = loadContinuationById(session.projectPath, sessionId, continuationId);
      if (!record) {
        throw new Error('continuation not found');
      }
      const restored = runtime.restoreContinuationSnapshot(record.snapshot);
      const branchFromMessageId = session.messages[session.messages.length - 1]?.id;
      const fork = branchFromMessageId
        ? forkSession({
          sourceSessionId: sessionId,
          branchFromMessageId,
        })
        : createSession({
          agentName: session.agentName,
          projectPath: session.projectPath,
          modelRef: session.modelRef,
          parentId: session.id,
          sessionRole: 'fork',
          children: [],
        });

      const restoredMessages = restored.tail.map((message) => ({
        id: message.id,
        role: (message.role === 'user' || message.role === 'assistant' || message.role === 'tool'
          ? message.role
          : 'assistant') as SessionMessage['role'],
        content: message.content,
        createdAt: message.createdAt,
      }));

      fork.messages = restoredMessages;
      fork.skillRunState = restored.workflowState.skillRunState;
      fork.updatedAt = Date.now();
      overwriteMessagesFile(fork.projectPath, fork.id, restoredMessages);
      persistSession(fork);
      updateStatus(fork.id, 'idle');

      return {
        sourceSessionId: sessionId,
        continuationId,
        session: fork,
        summary: restored.summary,
        tail: restoredMessages,
        workflowState: restored.workflowState,
      };
    },

    buildSkillContext(sessionId, skillNameOrArtifactIds, artifactIdsOrReferenceIds, referenceIdsArg) {
      let skillName: string | undefined;
      let artifactIds: string[] | undefined;
      let referenceIds: string[] | undefined;

      if (Array.isArray(skillNameOrArtifactIds)) {
        artifactIds = skillNameOrArtifactIds;
        referenceIds = artifactIdsOrReferenceIds;
      } else {
        skillName = skillNameOrArtifactIds;
        artifactIds = artifactIdsOrReferenceIds;
        referenceIds = referenceIdsArg;
      }

      const state = runtime.getRunState(sessionId);
      const session = getSession(sessionId);
      const restoredSkillRunState = skillName && session?.skillRunState?.skill === skillName
        ? restoreSkillContinuation({ skillRunState: session.skillRunState })
        : undefined;
      return buildSkillContext({
        sessionId,
        runStatus: state?.status ?? 'idle',
        recentSummary: state?.checkpoint ? `Checkpoint: ${state.checkpoint.stage}` : '',
        requestedArtifactIds: artifactIds,
        referenceArtifactIds: referenceIds,
        artifactStore,
        resolvedReferences: restoredSkillRunState?.resolvedReferences,
        referenceCache: restoredSkillRunState?.referenceCache,
        skillRunState: restoredSkillRunState,
      });
    },

    compactSession(sessionId, preserveLast = 2, skillRunState) {
      const session = getSession(sessionId);
      if (!session) {
        throw new Error('session not found');
      }
      const compacted = compactConversation({
        sessionId,
        messages: session.messages,
        preserveLast,
      });
      if (!skillRunState) return compacted;
      return {
        ...compacted,
        summary: mergeConversationSummaryWithRunState(compacted, skillRunState),
      };
    },

    createContinuationSnapshot(sessionId, workflowState) {
      const continuationPayload = createSkillContinuation(workflowState.skillRunState);
      return createContinuationSnapshot({
        sessionId,
        compacted: runtime.compactSession(sessionId, 2, workflowState.skillRunState),
        workflowState,
        ...(continuationPayload ? {
          workflowState: {
            ...workflowState,
            skillRunState: continuationPayload.skillRunState,
          },
        } : {}),
      });
    },

    restoreContinuationSnapshot(snapshot) {
      return restoreContinuationSnapshot(snapshot);
    },

    async sendMessage(input) {
      const session = getSession(input.sessionId);
      if (!session) {
        throw new Error('session not found');
      }

      // Apply a model switch that was queued while a previous turn was running
      // (mirrors streamMessage); see setSessionModel.
      if (session.pendingModelRef !== undefined) {
        updateSessionModelRef(input.sessionId, session.pendingModelRef ?? undefined);
        session.pendingModelRef = undefined;
      }

      const runAbortSignal = runState.beginRun(input.sessionId, input.abortSignal);

      const userMsg = createUserMessage(input.content, input.attachments);
      addMessage(input.sessionId, userMsg);
      updateStatus(input.sessionId, 'running');

      try {
        const skillInvocation = parseSkillInvocation(input.content);
        if (skillInvocation) {
          const result = await runtime.executeSkillByName(
            input.sessionId,
            skillInvocation.skillName,
            skillInvocation.input,
            { abort: runAbortSignal, spawnDepth: 0 },
          );
          const assistantMsg = createAssistantMessage(renderSkillExecutionResult(result));
          addMessage(input.sessionId, assistantMsg);
          updateStatus(input.sessionId, 'completed');
          runState.completeRun(input.sessionId);
          return { messages: [assistantMsg] };
        }

        const systemPrompt = await buildRuntimeSystemPrompt(session, externalSkillRoots);
        const newMessages = await runLoop({
          sessionId: input.sessionId,
          projectPath: session.projectPath,
          messages: session.messages,
          systemPrompt,
          tools: registry.all(),
          maxSteps: 50,
          generate: (msgs, sys, tls, abortSignal) => generateImpl(msgs, sys, tls, abortSignal, { modelRef: session.modelRef }),
          onMessage: (msg) => addMessage(input.sessionId, msg),
          abort: runAbortSignal,
          skillExecutor: runtime,
          spawnDepth: 0,
        });

        updateStatus(input.sessionId, 'completed');
        runState.completeRun(input.sessionId);
        return { messages: newMessages };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (isAbortError(err)) {
          updateStatus(input.sessionId, 'aborted');
          runState.markAborted(input.sessionId);
        } else {
          logger.error({ sessionId: input.sessionId, err: errMsg }, 'session run failed');
          updateStatus(input.sessionId, 'error', errMsg);
          runState.failRun(input.sessionId, errMsg);
        }
        throw err;
      }
    },

    async streamMessage(input) {
      const session = getSession(input.sessionId);
      if (!session) {
        throw new Error('session not found');
      }

      // Apply any model switch that was requested while a previous turn was
      // still running. Doing it here (before the run starts) keeps it out of any
      // in-flight generate call while guaranteeing this turn uses the new model.
      if (session.pendingModelRef !== undefined) {
        updateSessionModelRef(input.sessionId, session.pendingModelRef ?? undefined);
        session.pendingModelRef = undefined;
      }

      const runAbortSignal = runState.beginRun(input.sessionId, input.abortSignal);

      const userMsg = createUserMessage(input.content, input.attachments);
      addMessage(input.sessionId, userMsg);
      updateStatus(input.sessionId, 'running');

      const emitChildEvent = (event: ChildStreamEvent) => {
        input.sendEvent({ type: 'child', data: event });
      };

      try {
        const skillInvocation = parseSkillInvocation(input.content);
        if (skillInvocation) {
          const result = await runtime.executeSkillByName(
            input.sessionId,
            skillInvocation.skillName,
            skillInvocation.input,
            { abort: runAbortSignal, spawnDepth: 0, emitChildEvent },
          );
          const assistantMsg = createAssistantMessage(renderSkillExecutionResult(result));
          addMessage(input.sessionId, assistantMsg);
          input.sendEvent({
            type: 'assistant',
            data: {
              id: assistantMsg.id,
              content: assistantMsg.content,
            },
          });
          for (const pending of result.pendingConfirmations) {
            input.sendEvent({
              type: 'confirm_required',
              data: pending,
            });
          }
          updateStatus(input.sessionId, 'completed');
          runState.completeRun(input.sessionId);
          input.sendEvent({
            type: 'done',
            data: { status: 'completed' },
          });
          return;
        }

        const systemPrompt = await buildRuntimeSystemPrompt(session, externalSkillRoots);
        await runLoop({
          sessionId: input.sessionId,
          projectPath: session.projectPath,
          messages: session.messages,
          systemPrompt,
          tools: registry.all(),
          maxSteps: 50,
          generate: (msgs, sys, tls, abortSignal) => generateImpl(msgs, sys, tls, abortSignal, { modelRef: session.modelRef }),
          onMessage: (msg) => {
            addMessage(input.sessionId, msg);
            if (msg.role === 'assistant') {
              input.sendEvent({
                type: 'assistant',
                data: {
                  id: msg.id,
                  content: msg.content,
                  toolCalls: msg.toolCalls,
                },
              });
            } else if (msg.role === 'tool') {
              input.sendEvent({
                type: 'tool',
                data: {
                  id: msg.id,
                  results: msg.toolResults ?? [],
                },
              });
            }
          },
          abort: runAbortSignal,
          skillExecutor: runtime,
          spawnDepth: 0,
          emitChildEvent,
          emitConfirmation: (pending) => input.sendEvent({ type: 'confirm_required', data: pending }),
        });

        updateStatus(input.sessionId, 'completed');
        runState.completeRun(input.sessionId);
        input.sendEvent({
          type: 'done',
          data: { status: 'completed' },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (isAbortError(err)) {
          updateStatus(input.sessionId, 'aborted');
          runState.markAborted(input.sessionId);
          input.sendEvent({
            type: 'error',
            data: { message: errMsg },
          });
        } else {
          logger.error({ sessionId: input.sessionId, err: errMsg }, 'stream run failed');
          updateStatus(input.sessionId, 'error', errMsg);
          runState.failRun(input.sessionId, errMsg);
          input.sendEvent({
            type: 'error',
            data: { message: errMsg },
          });
        }
      }
    },
  };

  return runtime;
}

function createUserMessage(content: string, attachments?: MessageAttachment[]): SessionMessage {
  return {
    id: randomUUID(),
    role: 'user',
    content: renderAttachmentsIntoContent(content, attachments),
    createdAt: Date.now(),
  };
}

/**
 * Render resolved skill reference files into a prompt block so the model can
 * actually read the _reference / references material the workflow loaded.
 * Returns undefined when there is nothing to inject.
 */
function buildReferenceBlock(references?: ResolvedReferencePayload[]): string | undefined {
  if (!references || references.length === 0) {
    return undefined;
  }
  const sections = references.map((ref) => {
    const label = path.basename(ref.path);
    return `--- Reference: ${label} (${ref.path}) ---\n${ref.content}`;
  });
  return `Reference materials:\n${sections.join('\n\n')}`;
}

/**
 * Prepend structured attachment blocks to the user content so the LLM can see
 * the passages the user is discussing along with their provenance and anchor.
 * Selection attachments are rendered as quoted blocks with source + anchor hints;
 * chapter/file attachments are rendered as lightweight context pointers.
 */
function renderAttachmentsIntoContent(content: string, attachments?: MessageAttachment[]): string {
  if (!attachments || attachments.length === 0) {
    return content;
  }

  const blocks: string[] = [];
  for (const att of attachments) {
    if (att.type === 'selection') {
      const source = att.sourceType === 'chapter'
        ? `章节 ${att.chapterId ?? att.label}`
        : `文件 ${att.filePath ?? att.label}`;
      const quote = att.text.trim();
      blocks.push(
        [
          `[选段引用 · ${att.label}]`,
          `来源: ${source}`,
          `位置提示: 字符 ${att.anchor.rangeHint.from}-${att.anchor.rangeHint.to}`,
          '正文:',
          '"""',
          quote,
          '"""',
          '(用户正在讨论这段正文。)',
        ].join('\n'),
      );
    } else if (att.type === 'chapter') {
      blocks.push(`[引用章节: ${att.label}] (chapterId: ${att.id})`);
    } else {
      blocks.push(`[引用文件: ${att.label}] (path: ${att.id})`);
    }
  }

  return `${blocks.join('\n\n')}\n---\n${content}`;
}

function createAssistantMessage(content: string): SessionMessage {
  return {
    id: randomUUID(),
    role: 'assistant',
    content,
    createdAt: Date.now(),
  };
}

async function buildRuntimeSystemPrompt(session: SessionState, extraSkillRoots: string[] = []): Promise<string> {
  const projectSkillsDir = path.join(session.projectPath, '.orison', 'skills');
  const runtimeConfig = await loadRuntimeConfig(session.projectPath);
  const roots = [
    projectSkillsDir,
    ...extraSkillRoots,
    ...runtimeConfig.externalSkillRoots,
  ];

  type DiscoveredSkill = Awaited<ReturnType<typeof discoverSkills>>[number];
  const skills: DiscoveredSkill[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    let found: DiscoveredSkill[];
    try {
      found = await discoverSkills(root);
    } catch {
      continue;
    }
    for (const skill of found) {
      if (seen.has(skill.name)) continue;
      seen.add(skill.name);
      skills.push(skill);
    }
  }

  let skillsSummary: string | undefined;
  if (skills.length > 0) {
    const required = skills.filter((s) => s.priority === 'required');
    const optional = skills.filter((s) => s.priority !== 'required');

    const lines: string[] = [
      '## Available Skills',
      '',
      'Skills are pre-defined creative workflows. When the user\'s message matches a skill\'s trigger keywords or describes a task it is designed for, **immediately call the `skill` tool** with the skill\'s `name`. The skill\'s instructions will then be loaded into your context — follow them step by step, and invoke other skills they reference. Do not paraphrase a skill; invoke it.',
      '',
    ];

    if (required.length > 0) {
      lines.push('### Required skills — call immediately when triggered');
      lines.push('');
      for (const skill of required) {
        lines.push(`#### \`${skill.name}\``);
        if (skill.description) lines.push(skill.description);
        lines.push('');
      }
    }

    if (optional.length > 0) {
      lines.push('### Optional skills — call when relevant');
      lines.push('');
      for (const skill of optional) {
        lines.push(`#### \`${skill.name}\``);
        if (skill.description) lines.push(skill.description);
        lines.push('');
      }
    }

    skillsSummary = lines.join('\n').trimEnd();
  }

  let projectMeta = `Project path: ${session.projectPath}`;
  try {
    const metaRaw = await readFile(path.join(session.projectPath, 'project.yaml'), 'utf-8');
    projectMeta += `\nProject config:\n${metaRaw}`;
  } catch { /* no project.yaml */ }

  return buildSystemPrompt({
    orisonPrompt: DEFAULT_ORISON_PROMPT,
    projectMeta,
    skillsSummary,
    toolDescriptions: registry.all().map((tool) => `- ${tool.id}: ${tool.description}`).join('\n'),
  });
}

async function getProjectTree(projectPath: string, maxDepth = 2): Promise<string> {
  const lines: string[] = [];
  async function walk(dir: string, prefix: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const sorted = entries.filter(e => !e.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of sorted) {
        lines.push(`${prefix}${entry.isDirectory() ? entry.name + '/' : entry.name}`);
        if (entry.isDirectory()) {
          await walk(path.join(dir, entry.name), prefix + '  ', depth + 1);
        }
      }
    } catch { /* dir unreadable */ }
  }
  await walk(projectPath, '', 0);
  return lines.slice(0, 80).join('\n');
}

export function isSessionNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message === 'session not found';
}

function _isRunAlreadyActiveError(error: unknown): boolean {
  return error instanceof SessionRunAlreadyActiveError;
}

function _createPendingConfirmationState(
  sessionId: string,
  callId: string,
  name: string,
  input: unknown,
): PendingConfirmationState {
  return {
    sessionId,
    callId,
    name,
    input,
    createdAt: Date.now(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function parseSkillInvocation(content: string): { skillName: string; input?: string } | undefined {
  const match = content.match(/^\s*(?:@skill|\/skill)\s+([^\s]+)(?:\s+([\s\S]+))?\s*$/);
  if (!match) return undefined;
  return {
    skillName: match[1],
    input: match[2]?.trim() || undefined,
  };
}

function makeChildOnMessage(
  source: 'subagent' | 'skill',
  role: string,
  sessionId: string,
  depth: number,
  emit?: (event: ChildStreamEvent) => void,
): ((msg: SessionMessage) => void) | undefined {
  if (!emit) return undefined;
  return (msg) => {
    let inner: ChildInnerEvent | undefined;
    if (msg.role === 'assistant') {
      inner = {
        type: 'assistant',
        data: { id: msg.id, content: msg.content, toolCalls: msg.toolCalls },
      };
    } else if (msg.role === 'tool') {
      inner = {
        type: 'tool',
        data: { id: msg.id, results: msg.toolResults ?? [] },
      };
    }
    if (!inner) return;
    emit({ source, role, sessionId, depth, event: inner });
  };
}

function renderSkillExecutionResult(result: WorkflowExecutionResult): string {
  const sections: string[] = [];
  if (result.outputs.length > 0) {
    sections.push(result.outputs.join('\n\n'));
  }
  if (result.checkpoints.length > 0) {
    sections.push(`Checkpoints: ${result.checkpoints.join(', ')}`);
  }
  if (result.pendingConfirmations.length > 0) {
    sections.push(`Pending confirmations: ${result.pendingConfirmations.map((item) => item.name).join(', ')}`);
  }
  if (result.nested.length > 0) {
    sections.push(`Nested skills: ${result.nested.map((item) => item.skill).join(', ')}`);
  }
  return sections.join('\n\n') || `Skill "${result.skill}" completed.`;
}

async function loadProjectSkills(skillRegistry: SkillRegistry, _projectPath: string, externalRoots: string[]) {
  const roots = [
    ...externalRoots.map((root) => ({ path: root, source: 'external' as const })),
  ];
  const loaded = [];

  for (const skillsRoot of roots) {
    try {
      const entries = await readdir(skillsRoot.path, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const entryDir = path.join(skillsRoot.path, entry.name);
        const outcome = await loadSkillFromDir(entryDir, skillsRoot.source);
        if (outcome.kind !== 'loaded') continue;
        if (skillRegistry.has(outcome.skill.name)) continue;
        skillRegistry.register(outcome.skill);
        loaded.push(outcome.skill);
      }
    } catch {
      // missing root is allowed
    }
  }

  return loaded;
}
