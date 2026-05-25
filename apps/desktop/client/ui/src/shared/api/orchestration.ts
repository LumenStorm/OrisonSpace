import type { z } from 'zod';
import type { orchestrationRunSchema, orchestrationActionSchema } from '@orison/shared-contracts';
import { API_BASE } from '../constants';
import { jsonHeaders } from './session';

export type RunSnapshot = z.infer<typeof orchestrationRunSchema>;
export type OrchestrationAction = z.infer<typeof orchestrationActionSchema>;

export async function startOrchestrationRun(projectPath: string, requirement: string): Promise<RunSnapshot> {
  const res = await fetch(`${API_BASE}/v1/orchestration/runs`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ projectPath, requirement }),
  });
  if (!res.ok) throw new Error(`startOrchestrationRun:${res.status}`);
  return (await res.json()) as RunSnapshot;
}

export async function fetchOrchestrationRun(runId: string): Promise<RunSnapshot> {
  const res = await fetch(`${API_BASE}/v1/orchestration/runs/${encodeURIComponent(runId)}`);
  if (!res.ok) throw new Error(`fetchOrchestrationRun:${res.status}`);
  return (await res.json()) as RunSnapshot;
}

export async function performOrchestrationAction(
  runId: string,
  action: Omit<OrchestrationAction, 'runId'>,
): Promise<RunSnapshot> {
  const res = await fetch(`${API_BASE}/v1/orchestration/actions`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ runId, ...action }),
  });
  if (!res.ok) throw new Error(`performOrchestrationAction:${res.status}`);
  return (await res.json()) as RunSnapshot;
}
