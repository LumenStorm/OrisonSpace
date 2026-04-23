import type { z } from 'zod';
import type { orchestrationRunSchema } from '@orison/shared-contracts';

type RunSnapshot = z.infer<typeof orchestrationRunSchema>;

export function buildArchiveRecord(run: RunSnapshot) {
  return {
    runId: run.runId,
    status: run.status,
    completedNodes: run.completedNodes,
    review: run.review
  };
}
