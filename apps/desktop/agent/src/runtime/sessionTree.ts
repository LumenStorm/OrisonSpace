import { createSession, getSession } from '../agent/session';
import { persistSession } from '../agent/persistence';
import type { SessionMessage, SessionState } from '../types';
import type { SessionPermissionMode } from './toolPolicy';

export interface CreatePrimarySessionInput {
  agentName: string;
  projectPath: string;
  modelRef?: { keyId: string; modelId: string };
  permissionMode?: SessionPermissionMode;
}

export interface CreateChildSessionInput {
  parentId: string;
  agentName?: string;
  modelRef?: { keyId: string; modelId: string };
}

export interface ForkSessionInput {
  sourceSessionId: string;
  branchFromMessageId: string;
}

export function createPrimarySession(input: CreatePrimarySessionInput): SessionState {
  return createSession({
    agentName: input.agentName,
    projectPath: input.projectPath,
    modelRef: input.modelRef,
    permissionMode: input.permissionMode,
    sessionRole: 'primary',
    children: [],
  });
}

export function createChildSession(input: CreateChildSessionInput): SessionState {
  const parent = requireSession(input.parentId);
  const child = createSession({
    agentName: input.agentName ?? parent.agentName,
    projectPath: parent.projectPath,
    modelRef: input.modelRef ?? parent.modelRef,
    permissionMode: parent.permissionMode,
    parentId: parent.id,
    sessionRole: 'child',
    children: [],
  });
  attachChild(parent, child.id);
  return child;
}

function _getSessionTreeLink(parentId: string, childId: string): { parentId: string; childId: string } {
  const parent = requireSession(parentId);
  if (!parent.children.includes(childId)) {
    throw new Error(`child session "${childId}" is not linked to parent "${parentId}"`);
  }
  return { parentId, childId };
}

export function forkSession(input: ForkSessionInput): SessionState {
  const source = requireSession(input.sourceSessionId);
  const branchIndex = source.messages.findIndex((message) => message.id === input.branchFromMessageId);
  if (branchIndex === -1) {
    throw new Error(`branch message "${input.branchFromMessageId}" not found`);
  }

  const forkMessages = source.messages
    .slice(0, branchIndex + 1)
    .map(cloneMessage);

  const fork = createSession({
    agentName: source.agentName,
    projectPath: source.projectPath,
    modelRef: source.modelRef,
    permissionMode: source.permissionMode,
    messages: forkMessages,
    parentId: source.id,
    branchFromMessageId: input.branchFromMessageId,
    sessionRole: 'fork',
    children: [],
  });

  attachChild(source, fork.id);
  return fork;
}

export function listChildren(parentId: string): string[] {
  return [...requireSession(parentId).children];
}

function requireSession(sessionId: string): SessionState {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error(`session "${sessionId}" not found`);
  }
  return session;
}

function attachChild(parent: SessionState, childId: string): void {
  if (!parent.children.includes(childId)) {
    parent.children.push(childId);
    parent.updatedAt = Date.now();
    persistSession(parent);
  }
}

function cloneMessage(message: SessionMessage): SessionMessage {
  return JSON.parse(JSON.stringify(message)) as SessionMessage;
}
