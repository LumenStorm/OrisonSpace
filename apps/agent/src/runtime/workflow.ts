import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { createSession, getSession, deleteSession, addMessage, updateStatus, loadSession } from '../agent/session';
import { listSessions } from '../agent/persistence';
import { runLoop } from '../agent/loop';
import { generate } from '../provider/ipc-provider';
import { registry } from '../tool/registry';
import { buildSystemPrompt } from '../prompt/render';
import { discoverSkills } from '../skill/discovery';
import { SkillRegistry } from '../skill/runtime/registry';
import { createWorkflowExecutor, type WorkflowExecutionContext, type WorkflowExecutionResult } from '../skill/runtime/workflowExecutor';
import { loadDirectorySkill } from '../skill/runtime/directoryAdapter';
import { loadManifestSkill } from '../skill/runtime/manifestAdapter';
import { loadRuntimeConfig } from './config';
import { InMemoryArtifactStore, type ArtifactStore } from '../artifact/store';
import { buildSkillContext, type SkillRuntimeContext } from '../context/builder';
import { compactConversation, type CompactedConversation } from '../context/compaction';
import { createContinuationSnapshot, restoreContinuationSnapshot, type ContinuationSnapshot } from '../context/continuation';
import { logger } from '../logger';
import { getDefaultRunStateStore, RunStateStore, SessionRunAlreadyActiveError, type RunCheckpoint, type RunStateSnapshot } from './runState';
import { createPermissionService, type PermissionService } from './permission';
import { createSubagentRuntime, type SubagentRuntime, type SubagentDispatchInput, type SubagentDispatchOutput } from './subagent';
import type {
  ConfirmationResolution,
  PendingConfirmationState,
  RuntimeStreamEvent,
  SessionMessage,
  SessionState,
} from '../types';

export interface CreateSessionInput {
  agentName: string;
  projectPath: string;
  modelRef?: { keyId: string; modelId: string };
}

export interface SendMessageInput {
  sessionId: string;
  content: string;
  abortSignal: AbortSignal;
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
  continuation: ContinuationSnapshot;
}

export interface WorkflowRuntime {
  createSession(input: CreateSessionInput): SessionState;
  getSession(id: string, projectPath?: string): SessionState | undefined;
  listSessions(projectPath?: string): { sessions: ReturnType<typeof listSessions> };
  deleteSession(id: string): boolean;
  getRunState(sessionId: string): RunStateSnapshot | undefined;
  abortRun(sessionId: string): boolean;
  resumeRun(sessionId: string): RunCheckpoint | undefined;
  registerPendingConfirmation(sessionId: string, toolName: string, input: unknown): PendingConfirmationState;
  getPendingConfirmation(sessionId: string): PendingConfirmationState | undefined;
  resolveConfirmation(sessionId: string, callId: string, approved: boolean): ConfirmationResolution;
  dispatchSubagent(input: SubagentDispatchInput): Promise<SubagentDispatchOutput>;
  loadSkillsForSession(sessionId: string): Promise<string[]>;
  listSkills(projectPath: string): Promise<Array<{ name: string; description?: string; location: string; format: string }>>;
  executeSkill(skillName: string, context: WorkflowExecutionContext): Promise<WorkflowExecutionResult>;
  executeSkillByName(sessionId: string, skillName: string, request?: string | ExecuteSkillRequest): Promise<ExecuteSkillResponse>;
  buildSkillContext(sessionId: string, artifactIds?: string[], referenceIds?: string[]): SkillRuntimeContext;
  compactSession(sessionId: string, preserveLast?: number): CompactedConversation;
  createContinuationSnapshot(sessionId: string, workflowState: { activeSkill?: string; checkpoints: string[] }): ContinuationSnapshot;
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
  const skillExecutor = createWorkflowExecutor({
    registry: skillRegistry,
    executePrompt: async (prompt, _skill, context) => context.input ? `${prompt}\n\n${context.input}` : prompt,
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
  });

  const runtime: WorkflowRuntime = {
    createSession(input) {
      return createSession(input.agentName, input.projectPath, input.modelRef);
    },

    getSession(id, projectPath) {
      return getSession(id) ?? (projectPath ? loadSession(id, projectPath) : undefined);
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
      }));
    },

    async executeSkill(skillName, context) {
      return skillExecutor.executeSkill(skillName, context);
    },

    async executeSkillByName(sessionId, skillName, request) {
      await runtime.loadSkillsForSession(sessionId);
      const normalized = typeof request === 'string'
        ? { input: request }
        : (request ?? {});
      const skillContext = runtime.buildSkillContext(
        sessionId,
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
      });
      const continuation = runtime.createContinuationSnapshot(sessionId, {
        activeSkill: skillName,
        checkpoints: result.checkpoints,
      });
      return {
        ...result,
        continuation,
      };
    },

    buildSkillContext(sessionId, artifactIds, referenceIds) {
      const state = runtime.getRunState(sessionId);
      return buildSkillContext({
        sessionId,
        runStatus: state?.status ?? 'idle',
        recentSummary: state?.checkpoint ? `Checkpoint: ${state.checkpoint.stage}` : '',
        requestedArtifactIds: artifactIds,
        referenceArtifactIds: referenceIds,
        artifactStore,
      });
    },

    compactSession(sessionId, preserveLast = 2) {
      const session = getSession(sessionId);
      if (!session) {
        throw new Error('session not found');
      }
      return compactConversation({
        sessionId,
        messages: session.messages,
        preserveLast,
      });
    },

    createContinuationSnapshot(sessionId, workflowState) {
      return createContinuationSnapshot({
        sessionId,
        compacted: runtime.compactSession(sessionId),
        workflowState,
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

      const runAbortSignal = runState.beginRun(input.sessionId, input.abortSignal);

      const userMsg = createUserMessage(input.content);
      addMessage(input.sessionId, userMsg);
      updateStatus(input.sessionId, 'running');

      try {
        const skillInvocation = parseSkillInvocation(input.content);
        if (skillInvocation) {
          const result = await runtime.executeSkillByName(input.sessionId, skillInvocation.skillName, skillInvocation.input);
          const assistantMsg = createAssistantMessage(renderSkillExecutionResult(result));
          addMessage(input.sessionId, assistantMsg);
          updateStatus(input.sessionId, 'completed');
          runState.completeRun(input.sessionId);
          return { messages: [assistantMsg] };
        }

        const systemPrompt = await buildRuntimeSystemPrompt(session);
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

      const runAbortSignal = runState.beginRun(input.sessionId, input.abortSignal);

      const userMsg = createUserMessage(input.content);
      addMessage(input.sessionId, userMsg);
      updateStatus(input.sessionId, 'running');

      try {
        const skillInvocation = parseSkillInvocation(input.content);
        if (skillInvocation) {
          const result = await runtime.executeSkillByName(input.sessionId, skillInvocation.skillName, skillInvocation.input);
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

        const systemPrompt = await buildRuntimeSystemPrompt(session);
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

function createUserMessage(content: string): SessionMessage {
  return {
    id: randomUUID(),
    role: 'user',
    content,
    createdAt: Date.now(),
  };
}

function createAssistantMessage(content: string): SessionMessage {
  return {
    id: randomUUID(),
    role: 'assistant',
    content,
    createdAt: Date.now(),
  };
}

async function buildRuntimeSystemPrompt(session: SessionState): Promise<string> {
  const skillsDir = path.join(session.projectPath, '.orison', 'skills');
  const skills = await discoverSkills(skillsDir);
  const skillsSummary = skills.length > 0
    ? '## Available Skills\n' + skills.map((skill) => `- **${skill.name}**: ${skill.description ?? 'no description'}`).join('\n')
    : undefined;

  return buildSystemPrompt({
    orisonPrompt: DEFAULT_ORISON_PROMPT,
    projectMeta: `Project path: ${session.projectPath}`,
    skillsSummary,
    toolDescriptions: registry.all().map((tool) => `- ${tool.id}: ${tool.description}`).join('\n'),
  });
}

export function isSessionNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message === 'session not found';
}

export function isRunAlreadyActiveError(error: unknown): boolean {
  return error instanceof SessionRunAlreadyActiveError;
}

export function createPendingConfirmationState(
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

async function loadProjectSkills(skillRegistry: SkillRegistry, projectPath: string, externalRoots: string[]) {
  const roots = [path.join(projectPath, '.orison', 'skills'), ...externalRoots];
  const loaded = [];

  for (const skillsRoot of roots) {
    try {
      const entries = await readdir(skillsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const entryDir = path.join(skillsRoot, entry.name);
        try {
          const skill = await loadDirectorySkill(entryDir);
          if (!skillRegistry.has(skill.name)) {
            skillRegistry.register(skill);
            loaded.push(skill);
          }
          continue;
        } catch {
          // Fall through.
        }

        try {
          const skill = await loadManifestSkill(path.join(entryDir, 'skill.json'));
          if (!skillRegistry.has(skill.name)) {
            skillRegistry.register(skill);
            loaded.push(skill);
          }
        } catch {
          // skip invalid skill entries
        }
      }
    } catch {
      // missing root is allowed
    }
  }

  return loaded;
}
