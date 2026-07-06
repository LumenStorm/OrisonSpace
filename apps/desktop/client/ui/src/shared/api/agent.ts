import type { AgentMode } from '../store/types';
import type { ModelRef } from '@orison/shared-contracts';
import type { Attachment } from '../types/attachment';

const api = window.orisonDesktop;

export type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; input: unknown }>;
  toolResults?: Array<{ toolCallId?: string; toolId?: string; toolName?: string; output: string; metadata?: unknown }>;
  references?: Attachment[];
  createdAt: number;
};

export type AgentSessionMeta = {
  id: string;
  title: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};

export type AgentChildStreamEvent = {
  source: 'subagent' | 'skill';
  role: string;
  sessionId: string;
  depth: number;
  event:
    | { type: 'assistant'; data: { id: string; content: string; toolCalls?: unknown[] } }
    | { type: 'tool'; data: { id: string; results: unknown[] } };
};

export type AgentStreamEvent =
  | { type: 'assistant'; data: { id: string; content: string; toolCalls?: unknown[] } }
  | { type: 'tool'; data: { id: string; results: unknown[] } }
  | { type: 'confirm_required'; data: { sessionId?: string; callId: string; name: string; input: unknown; createdAt?: number } }
  | { type: 'done'; data: { status: string } }
  | { type: 'error'; data: { message: string } }
  | { type: 'child'; data: AgentChildStreamEvent }
  | { type: 'compaction'; data: { compactedCount: number } };

export type AgentSkillInfo = {
  name: string;
  description?: string;
  location: string;
  format: string;
  source?: 'project' | 'external';
};

export async function createAgentSession(projectPath: string, mode?: AgentMode, modelRef?: ModelRef | null) {
  return api.createAgentSession({
    agentName: 'writer',
    projectPath,
    mode: mode ?? 'suggest',
    modelRef: modelRef ?? undefined,
  }) as Promise<{ id: string; agentName: string; projectPath: string; status: string; messages: AgentMessage[] }>;
}

export async function fetchAgentSession(sessionId: string, projectPath?: string) {
  return api.getAgentSession(sessionId, projectPath) as Promise<{ id: string; status: string; messages: AgentMessage[]; modelRef?: ModelRef } | null>;
}

/**
 * Persist the model bound to an existing session. The model is a session-level
 * setting applied to the next turn — it does not retroactively change prior
 * messages, and the runtime refuses the change while a run is in flight.
 */
export async function setAgentSessionModel(sessionId: string, projectPath: string | undefined, modelRef: ModelRef | null) {
  return api.setAgentSessionModel(sessionId, projectPath, modelRef ?? undefined);
}

export async function deleteAgentSession(sessionId: string) {
  return api.deleteAgentSession(sessionId);
}

export async function listAgentSessions(projectPath: string) {
  const result = await api.listAgentSessions(projectPath) as { sessions: AgentSessionMeta[] };
  return result.sessions;
}

export async function listAgentSkills(projectPath: string) {
  const result = await api.listAgentSkills(projectPath);
  if (Array.isArray(result)) return result as AgentSkillInfo[];
  return ((result as any)?.skills ?? []) as AgentSkillInfo[];
}

export async function resolveAgentConfirmation(sessionId: string, callId: string, approved: boolean) {
  return api.resolveAgentConfirmation(sessionId, callId, approved);
}

/**
 * Stream a message to the agent. Returns a cleanup function to unsubscribe from events,
 * and a promise that resolves when streaming completes.
 * `attachments` are structured (selection / chapter / file) references the runtime
 * renders into the prompt — NOT flattened into the content string.
 * To abort, call window.orisonDesktop.abortAgentRun(sessionId).
 */
export function streamAgentMessage(
  sessionId: string,
  content: string,
  onEvent: (event: AgentStreamEvent) => void,
  attachments?: Attachment[],
): { promise: Promise<{ status: string }>; cleanup: () => void } {
  const cleanup = api.onAgentStreamEvent((event) => {
    const ev = event as AgentStreamEvent & { sessionId?: string };
    // 按 sessionId 过滤，忽略其他 session 的事件
    if (ev.sessionId && ev.sessionId !== sessionId) return;
    onEvent(ev);
  });

  const promise = api.streamAgentMessage({ sessionId, content, attachments });

  return { promise, cleanup };
}
