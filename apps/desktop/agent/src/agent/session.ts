import { randomUUID } from 'node:crypto';
import type { SessionState, SessionMessage, RetentionPriority } from '../types';
import { persistSession, appendMessageToFile, loadMessagesFromFile, deletePersistedSession, loadSessionMeta, overwriteMessagesFile } from './persistence';

const sessions = new Map<string, SessionState>();

export interface CreateSessionOptions {
  id?: string;
  agentName: string;
  projectPath: string;
  modelRef?: { keyId: string; modelId: string };
  messages?: SessionMessage[];
  parentId?: string;
  children?: string[];
  branchFromMessageId?: string;
  sessionRole?: 'primary' | 'child' | 'fork';
}

export function createSession(
  agentNameOrOptions: string | CreateSessionOptions,
  projectPathArg?: string,
  modelRefArg?: { keyId: string; modelId: string },
): SessionState {
  const options = typeof agentNameOrOptions === 'string'
    ? {
        agentName: agentNameOrOptions,
        projectPath: projectPathArg as string,
        modelRef: modelRefArg,
      }
    : agentNameOrOptions;
  const session: SessionState = {
    id: options.id ?? randomUUID(),
    agentName: options.agentName,
    projectPath: options.projectPath,
    status: 'idle',
    messages: options.messages ?? [],
    modelRef: options.modelRef,
    parentId: options.parentId,
    children: options.children ?? [],
    branchFromMessageId: options.branchFromMessageId,
    sessionRole: options.sessionRole,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    skillRunState: undefined,
  };
  sessions.set(session.id, session);
  persistSession(session);
  if (session.messages.length > 0) {
    overwriteMessagesFile(session.projectPath, session.id, session.messages);
  }
  return session;
}

export function getSession(id: string): SessionState | undefined {
  return sessions.get(id);
}

export function loadSession(id: string, projectPath: string): SessionState | undefined {
  if (sessions.has(id)) return sessions.get(id);
  const meta = loadSessionMeta(projectPath, id);
  const messages = loadMessagesFromFile(projectPath, id);
  if (messages.length === 0 && !meta) return undefined;
  const session: SessionState = {
    id,
    agentName: meta?.agentName ?? 'writer',
    projectPath,
    status: meta?.status ?? 'idle',
    messages,
    modelRef: meta?.modelRef,
    parentId: meta?.parentId,
    children: meta?.children ?? [],
    branchFromMessageId: meta?.branchFromMessageId,
    sessionRole: meta?.sessionRole,
    createdAt: meta?.createdAt ?? messages[0]?.createdAt ?? Date.now(),
    updatedAt: meta?.updatedAt ?? messages[messages.length - 1]?.createdAt ?? Date.now(),
    error: meta?.error,
    skillRunState: meta?.skillRunState,
    contextState: meta?.contextState,
    pinnedContext: meta?.pinnedContext,
  };
  sessions.set(id, session);
  return session;
}

export function deleteSession(id: string): boolean {
  const session = sessions.get(id);
  if (session) {
    deletePersistedSession(session.projectPath, id);
  }
  return sessions.delete(id);
}

export function addMessage(sessionId: string, message: SessionMessage): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (!message.retention) {
    message.retention = classifyRetention(message);
  }
  session.messages.push(message);
  session.updatedAt = Date.now();
  appendMessageToFile(session.projectPath, sessionId, message);
}

function classifyRetention(msg: SessionMessage): RetentionPriority {
  if (msg.role === 'user') return 'critical';
  if (msg.role === 'tool') {
    const totalOutput = msg.toolResults?.reduce((sum, r) => sum + r.output.length, 0) ?? 0;
    return totalOutput > 2000 ? 'compressible' : 'normal';
  }
  return 'normal';
}

export function updateStatus(sessionId: string, status: SessionState['status'], error?: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.status = status;
  if (error) session.error = error;
  session.updatedAt = Date.now();
  persistSession(session);
}

/**
 * Update the model bound to a session. The model is a session-level setting:
 * it applies to the next turn, not retroactively. Callers should only invoke
 * this while the session is idle so a change can't bleed into an in-flight run.
 */
export function updateSessionModelRef(
  sessionId: string,
  modelRef: { keyId: string; modelId: string } | undefined,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.modelRef = modelRef;
  session.updatedAt = Date.now();
  persistSession(session);
}
