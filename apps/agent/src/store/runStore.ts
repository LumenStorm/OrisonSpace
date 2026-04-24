import { orchestrationRunSchema } from '@orison/shared-contracts';
import type { RunSnapshot } from '../contracts/run';

const store = new Map<string, RunSnapshot>();

export const runStore = {
  save(snapshot: RunSnapshot) {
    store.set(snapshot.runId, orchestrationRunSchema.parse(snapshot));
  },
  get(runId: string) {
    return store.get(runId) ?? null;
  },
  update(runId: string, patch: Partial<RunSnapshot>) {
    const current = store.get(runId);
    if (!current) throw new Error(`Run not found: ${runId}`);
    const next = orchestrationRunSchema.parse({ ...current, ...patch });
    store.set(runId, next);
    return next;
  }
};
