import type { OrchestrationRun } from '@orison/shared-contracts';

export type RunSnapshot = OrchestrationRun;

export type OrchestrationAction = {
  runId: string;
  action: string;
  nodeId?: string;
  payload?: unknown;
};

export async function startOrchestrationRun(projectPath: string, requirement: string): Promise<RunSnapshot> {
  return window.orisonDesktop.startOrchestrationRun({ projectPath, requirement });
}

export async function fetchOrchestrationRun(runId: string): Promise<RunSnapshot> {
  return window.orisonDesktop.getOrchestrationRun(runId);
}

export async function performOrchestrationAction(runId: string, action: Omit<OrchestrationAction, 'runId'>): Promise<RunSnapshot> {
  return window.orisonDesktop.performOrchestrationAction({ runId, ...action });
}
