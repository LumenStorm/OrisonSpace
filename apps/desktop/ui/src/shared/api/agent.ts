import type { AgentMode } from '../store/types';
import type { ModelRef } from '@orison/shared-contracts';
import { API_BASE } from '../constants';
import { authJsonHeaders, authHeaders, throwIfSessionExpired } from './session';

const AGENT_BASE = API_BASE;

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

export type AgentStreamEvent =
  | { type: 'assistant'; data: { id: string; content: string; toolCalls?: unknown[] } }
  | { type: 'tool'; data: { id: string; results: unknown[] } }
  | { type: 'confirm_required'; data: { sessionId?: string; callId: string; name: string; input: unknown; createdAt?: number } }
  | { type: 'done'; data: { status: string } }
  | { type: 'error'; data: { message: string } };

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

export type AgentContinuationRestoreResponse = {
  restored: {
    sourceSessionId: string;
    continuationId: string;
    session: { id: string; parentId?: string; sessionRole?: 'primary' | 'child' | 'fork'; messages?: AgentMessage[] };
    summary: string;
    tail: Array<{ id: string; role: string; content: string; createdAt: number }>;
    workflowState: AgentContinuation['workflowState'];
  };
};

export async function createAgentSession(
  projectPath: string,
  mode: AgentMode,
  modelRef?: ModelRef | null,
): Promise<{ id: string }> {
  const res = await fetch(`${AGENT_BASE}/v1/agent/sessions`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ projectPath, mode, modelRef }),
  });
  if (!res.ok) throw new Error(`createAgentSession:${res.status}`);
  return res.json() as Promise<{ id: string }>;
}

export async function fetchAgentSession(id: string): Promise<{ id: string; messages: AgentMessage[] }> {
  const res = await fetch(`${AGENT_BASE}/v1/agent/sessions/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchAgentSession:${res.status}`);
  return res.json() as Promise<{ id: string; messages: AgentMessage[] }>;
}

export async function deleteAgentSession(id: string): Promise<void> {
  await fetch(`${AGENT_BASE}/v1/agent/sessions/${id}`, { method: 'DELETE', headers: authHeaders() });
}

export async function listAgentSessions(projectPath: string): Promise<AgentSessionMeta[]> {
  const res = await fetch(`${AGENT_BASE}/v1/agent/sessions?projectPath=${encodeURIComponent(projectPath)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json() as { sessions: AgentSessionMeta[] };
  return data.sessions;
}

export async function listAgentSkills(projectPath: string): Promise<AgentSkillInfo[]> {
  const res = await fetch(`${AGENT_BASE}/v1/agent/skills?projectPath=${encodeURIComponent(projectPath)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`listAgentSkills:${res.status}`);
  const data = await res.json() as { skills: AgentSkillInfo[] };
  return data.skills;
}

export async function listAgentContinuations(sessionId: string): Promise<AgentContinuationListItem[]> {
  const res = await fetch(`${AGENT_BASE}/v1/agent/sessions/${sessionId}/continuations`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`listAgentContinuations:${res.status}`);
  const data = await res.json() as { continuations: AgentContinuationListItem[] };
  return data.continuations;
}

export async function restoreAgentContinuation(
  sessionId: string,
  continuationId: string,
): Promise<AgentContinuationRestoreResponse> {
  const res = await fetch(`${AGENT_BASE}/v1/agent/sessions/${sessionId}/continuations/restore`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ continuationId }),
  });
  if (!res.ok) throw new Error(`restoreAgentContinuation:${res.status}`);
  return res.json() as Promise<AgentContinuationRestoreResponse>;
}

export async function resolveAgentConfirmation(
  sessionId: string,
  callId: string,
  approved: boolean,
): Promise<{ callId: string; approved: boolean }> {
  const res = await fetch(`${AGENT_BASE}/v1/agent/sessions/${sessionId}/confirm`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ callId, approved }),
  });
  if (!res.ok) throw new Error(`resolveAgentConfirmation:${res.status}`);
  return res.json() as Promise<{ callId: string; approved: boolean }>;
}

export async function executeAgentSkill(
  sessionId: string,
  skillName: string,
  options?: { input?: string; artifactIds?: string[]; referenceIds?: string[] },
): Promise<{ skill: string; status: string; outputs: string[]; continuation?: AgentContinuation }> {
  const res = await fetch(`${AGENT_BASE}/v1/agent/sessions/${sessionId}/skills/${encodeURIComponent(skillName)}/execute`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify(options ?? {}),
  });
  if (!res.ok) throw new Error(`executeAgentSkill:${res.status}`);
  return res.json() as Promise<{ skill: string; status: string; outputs: string[]; continuation?: AgentContinuation }>;
}

/**
 * Send a message and receive SSE stream events.
 * Returns an AbortController to cancel the stream.
 */
export function streamAgentMessage(
  sessionId: string,
  content: string,
  onEvent: (event: AgentStreamEvent) => void,
): AbortController {
  const ac = new AbortController();

  fetch(`${AGENT_BASE}/v1/agent/sessions/${sessionId}/stream`, {
    method: 'POST',
    headers: authJsonHeaders(),
    body: JSON.stringify({ content }),
    signal: ac.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onEvent({ type: 'error', data: { message: `Stream failed: ${res.status}` } });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent({ type: currentEvent, data } as AgentStreamEvent);
          } catch { /* skip malformed */ }
          currentEvent = '';
        }
      }
    }
  }).catch((err) => {
    if (err instanceof Error && err.name !== 'AbortError') {
      onEvent({ type: 'error', data: { message: err.message } });
    }
  });

  return ac;
}
