import { randomUUID } from 'node:crypto';
import type { SessionState, SessionMessage } from '../types';
import { persistSession, appendMessageToFile, loadMessagesFromFile, deletePersistedSession } from './persistence';

const sessions = new Map<string, SessionState>();

export function createSession(agentName: string, projectPath: string, modelRef?: { keyId: string; modelId: string }): SessionState {
  const session: SessionState = {
    id: randomUUID(),
    agentName,
    projectPath,
    status: 'idle',
    messages: [],
    modelRef,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(session.id, session);
  persistSession(session);
  return session;
}

export function getSession(id: string): SessionState | undefined {
  return sessions.get(id);
}

export function loadSession(id: string, projectPath: string): SessionState | undefined {
  if (sessions.has(id)) return sessions.get(id);
  const messages = loadMessagesFromFile(projectPath, id);
  if (messages.length === 0) return undefined;
  const session: SessionState = {
    id,
    agentName: 'writer',
    projectPath,
    status: 'idle',
    messages,
    createdAt: messages[0]?.createdAt ?? Date.now(),
    updatedAt: messages[messages.length - 1]?.createdAt ?? Date.now(),
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
  session.messages.push(message);
  session.updatedAt = Date.now();
  appendMessageToFile(session.projectPath, sessionId, message);
}

export function updateStatus(sessionId: string, status: SessionState['status'], error?: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.status = status;
  if (error) session.error = error;
  session.updatedAt = Date.now();
  persistSession(session);
}
