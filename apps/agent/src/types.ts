import { z } from 'zod';
import type { SerializedSkillRunState } from './runtime/skillRunState';

// ── Agent Config ──

export const agentConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  model: z.object({
    keyId: z.string(),
    modelId: z.string(),
  }).optional(),
  maxSteps: z.number().int().positive().default(50),
  temperature: z.number().min(0).max(2).optional(),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

// ── Tool Types ──

export interface ToolContext {
  sessionId: string;
  projectPath: string;
  abort: AbortSignal;
}

export interface ToolResult {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export interface SessionMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolCallResult[];
  createdAt: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolCallResult {
  toolCallId: string;
  output: string;
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
  | { type: 'error'; data: { message: string } };

export type RuntimeStreamEvent = RuntimeEventPayload;

export interface SessionState {
  id: string;
  agentName: string;
  projectPath: string;
  status: SessionStatus;
  messages: SessionMessage[];
  modelRef?: { keyId: string; modelId: string };
  parentId?: string;
  children: string[];
  branchFromMessageId?: string;
  sessionRole?: 'primary' | 'child' | 'fork';
  createdAt: number;
  updatedAt: number;
  error?: string;
  skillRunState?: SerializedSkillRunState;
}
