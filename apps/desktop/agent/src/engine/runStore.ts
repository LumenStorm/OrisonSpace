import type { RunResult } from './runService';

const runStore = new Map<string, RunResult>();

export function registerRun(run: RunResult): void {
  runStore.set(run.runId, run);
}

export function getRun(runId: string): RunResult | undefined {
  return runStore.get(runId);
}
