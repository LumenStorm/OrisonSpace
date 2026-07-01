import type { PermissionService } from './permission';
import { createChildSession } from './sessionTree';
import type { WorkflowRuntime } from './workflow';
import type { SessionState } from '../types';
import { evictSession } from '../agent/session';

export interface SubagentDispatchInput {
  parentSessionId: string;
  role: string;
  prompt: string;
  complete: (context: {
    session: SessionState;
    permission: PermissionService;
    prompt: string;
    role: string;
  }) => Promise<{ content: string }>;
}

export interface SubagentResult {
  childSessionId: string;
  role: string;
  content: string;
  status: 'completed';
}

export interface SubagentDispatchOutput {
  session: SessionState;
  permission: PermissionService;
  result: SubagentResult;
}

export interface SubagentRuntime {
  dispatch(input: SubagentDispatchInput): Promise<SubagentDispatchOutput>;
}

export interface SubagentRuntimeOptions {
  runtime: WorkflowRuntime;
  narrowPermission: (parentSession: SessionState) => PermissionService;
}

export function createSubagentRuntime(options: SubagentRuntimeOptions): SubagentRuntime {
  return {
    async dispatch(input) {
      const parentSession = options.runtime.getSession(input.parentSessionId);
      if (!parentSession) {
        throw new Error(`session "${input.parentSessionId}" not found`);
      }

      const childSession = createChildSession({
        parentId: parentSession.id,
        agentName: input.role,
        modelRef: parentSession.modelRef,
      });

      const permission = options.narrowPermission(parentSession);
      const completed = await input.complete({
        session: childSession,
        permission,
        prompt: input.prompt,
        role: input.role,
      });

      evictSession(childSession.id);

      return {
        session: childSession,
        permission,
        result: {
          childSessionId: childSession.id,
          role: input.role,
          content: completed.content,
          status: 'completed',
        },
      };
    },
  };
}
