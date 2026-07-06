import { z } from 'zod';
import type { NormalizedSkill } from './skill/types';
import type { SessionPermissionMode } from './runtime/toolPolicy';
import type { SerializedSkillRunState } from './runtime/skillRunState';

// ── Agent Config ──

const _agentConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  model: z.object({
    keyId: z.string(),
    modelId: z.string(),
  }).optional(),
  maxSteps: z.number().int().positive().default(50),
  temperature: z.number().min(0).max(2).optional(),
});

export type AgentConfig = z.infer<typeof _agentConfigSchema>;

// ── Tool Types ──

export interface SkillExecutionResult {
  skill: string;
  outputs: string[];
  checkpoints: string[];
  pendingConfirmations: Array<{ name: string }>;
  nested: Array<{ skill: string }>;
}

export interface SkillExecutorInvokeOptions {
  abort?: AbortSignal;
  spawnDepth?: number;
  emitChildEvent?: (event: ChildStreamEvent) => void;
  /** Surface a skill's pending tool confirmation to the UI as it arises. */
  emitConfirmation?: (pending: PendingConfirmationState) => void;
}

export interface SkillExecutorRef {
  loadSkill?(sessionId: string, skillName: string): Promise<NormalizedSkill | undefined>;
  executeSkillByName(
    sessionId: string,
    skillName: string,
    request?: string | { input?: string },
    options?: SkillExecutorInvokeOptions,
  ): Promise<SkillExecutionResult>;
  runSubagent(
    parentSessionId: string,
    role: string,
    prompt: string,
    options?: SkillExecutorInvokeOptions,
  ): Promise<{ content: string }>;
  listSkillNames?(sessionId: string): Promise<string[]>;
}

export type ChildInnerEvent =
  | { type: 'assistant'; data: { id: string; content: string; toolCalls?: ToolCall[] } }
  | { type: 'tool'; data: { id: string; results: ToolCallResult[] } };

export interface ChildStreamEvent {
  source: 'subagent' | 'skill';
  role: string;
  sessionId: string;
  depth: number;
  event: ChildInnerEvent;
}

export interface ToolContext {
  sessionId: string;
  projectPath: string;
  abort: AbortSignal;
  skillExecutor?: SkillExecutorRef;
  spawnDepth?: number;
  emitChildEvent?: (event: ChildStreamEvent) => void;
  /** Surface a tool's (e.g. skill's) pending confirmation to the UI. */
  emitConfirmation?: (pending: PendingConfirmationState) => void;
}

export const MAX_SPAWN_DEPTH = 5;

export class SpawnDepthExceededError extends Error {
  constructor(public readonly depth: number, public readonly limit: number = MAX_SPAWN_DEPTH) {
    super(`Spawn depth ${depth} exceeds limit ${limit}; refusing further nesting.`);
    this.name = 'SpawnDepthExceededError';
  }
}

export interface ToolResult {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
  /**
   * 标记该结果即为面向用户的最终答复。为 true 时，agent 主循环不再就此结果
   * 追加生成新一轮回复——用于 skill 这类「输出本身就是回答」的工具，避免
   * skill 已经对用户说完话后，父模型又把同样内容复述一遍。
   */
  terminal?: boolean;
}

export interface ToolDefinition<TParams = any> {
  id: string;
  description: string;
  parameters: z.ZodType<TParams>;
  execute: (params: TParams, ctx: ToolContext) => Promise<ToolResult>;
}

// ── Skill Types ──

export interface SkillInfo {
  name: string;
  description?: string;
  location: string;
  content: string;
}

// ── Session Types ──

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type RetentionPriority = 'critical' | 'normal' | 'compressible';

export interface SessionMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolCallResult[];
  createdAt: number;
  retention?: RetentionPriority;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  output: string;
  metadata?: Record<string, unknown>;
}

export type SessionStatus = 'idle' | 'running' | 'completed' | 'error' | 'aborted';

export type WorkflowRunStatus = SessionStatus;

export interface PendingConfirmationState {
  sessionId: string;
  callId: string;
  name: string;
  input: unknown;
  createdAt: number;
}

export interface ConfirmationResolution {
  callId: string;
  approved: boolean;
}

export type RuntimeEventPayload =
  | { type: 'assistant'; data: { id: string; content: string; toolCalls?: ToolCall[] } }
  | { type: 'tool'; data: { id: string; results: ToolCallResult[] } }
  | { type: 'confirm_required'; data: PendingConfirmationState }
  | { type: 'done'; data: { status: WorkflowRunStatus } }
  | { type: 'error'; data: { message: string } }
  | { type: 'child'; data: ChildStreamEvent }
  | { type: 'compaction'; data: { compactedCount: number } };

export type RuntimeStreamEvent = RuntimeEventPayload;

export interface SessionState {
  id: string;
  agentName: string;
  projectPath: string;
  status: SessionStatus;
  permissionMode?: SessionPermissionMode;
  messages: SessionMessage[];
  modelRef?: { keyId: string; modelId: string };
  /**
   * A model switch requested while the session was running. It is applied at the
   * start of the next turn so it can't bleed into an in-flight generate call.
   * In-memory only — not persisted; a switch made while idle writes modelRef
   * directly instead.
   */
  pendingModelRef?: { keyId: string; modelId: string } | null;
  parentId?: string;
  children: string[];
  branchFromMessageId?: string;
  sessionRole?: 'primary' | 'child' | 'fork';
  createdAt: number;
  updatedAt: number;
  error?: string;
  skillRunState?: SerializedSkillRunState;
  contextState?: {
    compactedSummary?: string;
    compactionCount: number;
    lastCompactionAt?: number;
    totalCompactedMessages: number;
    tokenCalibrationRatio: number;
  };
  pinnedContext?: import('./context/pinnedContext').PinnedContextItem[];
}
