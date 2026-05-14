import { randomUUID } from 'node:crypto';
import type { PendingConfirmationState } from '../types';

export type PermissionAction = 'allow' | 'ask' | 'deny';
export type PermissionClass = 'read' | 'write' | 'dangerous' | 'creative' | 'external';

export interface PermissionRule {
  action: PermissionAction;
  class: PermissionClass;
  pattern: RegExp;
}

export interface PermissionEvaluationInput {
  sessionId: string;
  toolName: string;
  input?: unknown;
}

export type PermissionEvaluation =
  | { action: 'allow'; class: PermissionClass }
  | { action: 'deny'; class: PermissionClass; reason: string }
  | { action: 'ask'; class: PermissionClass; pending: PendingConfirmationState };

export interface PermissionResolution {
  callId: string;
  approved: boolean;
}

export interface PermissionService {
  evaluate(input: PermissionEvaluationInput): PermissionEvaluation;
  getPending(sessionId: string): PendingConfirmationState | undefined;
  resolvePending(sessionId: string, callId: string, approved: boolean): PermissionResolution;
}

export interface PermissionServiceOptions {
  rules?: PermissionRule[];
}

const DEFAULT_RULES: PermissionRule[] = [
  { action: 'allow', class: 'read', pattern: /^(read_|list_|search|memory_query|project_meta|git_status|git_log|outline_read|chapter_list|chapter_read)/ },
  { action: 'ask', class: 'write', pattern: /^(write_|memory_update|chapter_write|outline_update|edit_image|generate_image|git_commit)/ },
  { action: 'deny', class: 'dangerous', pattern: /^(delete_|remove_|reset_|rm_)/ },
];

export function createPermissionService(options: PermissionServiceOptions = {}): PermissionService {
  const rules = options.rules ?? DEFAULT_RULES;
  const pendingBySession = new Map<string, PendingConfirmationState>();

  return {
    evaluate(input) {
      const rule = rules.find((candidate) => candidate.pattern.test(input.toolName))
        ?? { action: 'ask' as const, class: 'external' as const, pattern: /.*/ };

      if (rule.action === 'allow') {
        return {
          action: 'allow',
          class: rule.class,
        };
      }

      if (rule.action === 'deny') {
        return {
          action: 'deny',
          class: rule.class,
          reason: `tool "${input.toolName}" denied by permission policy`,
        };
      }

      const pending: PendingConfirmationState = {
        sessionId: input.sessionId,
        callId: randomUUID(),
        name: input.toolName,
        input: input.input,
        createdAt: Date.now(),
      };
      pendingBySession.set(input.sessionId, pending);
      return {
        action: 'ask',
        class: rule.class,
        pending,
      };
    },

    getPending(sessionId) {
      return pendingBySession.get(sessionId);
    },

    resolvePending(sessionId, callId, approved) {
      const pending = pendingBySession.get(sessionId);
      if (!pending || pending.callId !== callId) {
        throw new Error(`pending confirmation "${callId}" not found for session "${sessionId}"`);
      }
      pendingBySession.delete(sessionId);
      return {
        callId,
        approved,
      };
    },
  };
}
