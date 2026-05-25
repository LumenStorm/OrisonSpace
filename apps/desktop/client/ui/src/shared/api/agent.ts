import type { AgentMode } from '../store/types';
import type { ModelRef } from '@orison/shared-contracts';

const api = window.orisonDesktop;

export type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; input: unknown }>;
  toolResults?: Array<{ toolId: string; output: string; metadata?: unknown }>;
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
  | { type: 'child'; data: AgentChildStreamEvent };

export type AgentSkillInfo = {
  name: string;
  description?: string;
  location: string;
  format: string;
  source?: 'project' | 'external';
};

export type AgentContinuation = {
  continuationId?: string;
  sessionId: string;
  compacted: {
    sessionId: string;
    summary: string;
    tail: Array<{ id: string; role: string; content: string; createdAt: number }>;
  };
  workflowState: {
    activeSkill?: string;
    checkpoints: string[];
  };
};

export type AgentContinuationRestoreState = {
  sourceSessionId: string;
  sessionId: string;
  summary: string;
  tail: Array<{ id: string; role: string; content: string; createdAt: number }>;
  workflowState: AgentContinuation['workflowState'];
};

export type AgentContinuationListItem = {
  continuationId: string;
  sessionId: string;
  createdAt: number;
  summary: string;
  workflowState: AgentContinuation['workflowState'];
};

export async function createAgentSession(projectPath: string, mode?: AgentMode, modelRef?: ModelRef | null) {
  return api.createAgentSession({
    agentName: mode ?? 'writer',
    projectPath,
    modelRef: modelRef ?? undefined,
  }) as Promise<{ id: string; agentName: string; projectPath: string; status: string; messages: AgentMessage[] }>;
}

export async function fetchAgentSession(sessionId: string, projectPath?: string) {
  return api.getAgentSession(sessionId, projectPath) as Promise<{ id: string; status: string; messages: AgentMessage[] } | null>;
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

export async function executeAgentSkill(sessionId: string, skillName: string, request?: { input?: string; artifactIds?: string[]; referenceIds?: string[] }) {
  return api.executeAgentSkill(sessionId, skillName, request) as Promise<{ outputs: string[]; continuation?: AgentContinuation }>;
}

export async function resolveAgentConfirmation(sessionId: string, callId: string, approved: boolean) {
  return api.resolveAgentConfirmation(sessionId, callId, approved);
}

export async function listAgentContinuations(sessionId: string) {
  return api.listAgentContinuations(sessionId) as Promise<AgentContinuationListItem[]>;
}

export async function restoreAgentContinuation(sessionId: string, continuationId: string): Promise<AgentContinuationRestoreState> {
  const raw = await api.restoreAgentContinuation(sessionId, continuationId) as any;
  return {
    sourceSessionId: raw.sourceSessionId,
    sessionId: raw.session?.id ?? raw.sessionId,
    summary: raw.summary,
    tail: raw.tail,
    workflowState: raw.workflowState,
  };
}

/**
 * Stream a message to the agent. Returns a cleanup function to unsubscribe from events,
 * and a promise that resolves when streaming completes.
 * To abort, call window.orisonDesktop.abortAgentRun(sessionId).
 */
export function streamAgentMessage(
  sessionId: string,
  content: string,
  onEvent: (event: AgentStreamEvent) => void,
): { promise: Promise<{ status: string }>; cleanup: () => void } {
  const cleanup = api.onAgentStreamEvent((event) => {
    onEvent(event as AgentStreamEvent);
  });

  const promise = api.streamAgentMessage({ sessionId, content });

  return { promise, cleanup };
}
