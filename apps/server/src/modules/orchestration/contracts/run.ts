import type { z } from 'zod';
import type { orchestrationRunSchema, startOrchestrationRunSchema } from '@orison/shared-contracts';

export type RunSnapshot = z.infer<typeof orchestrationRunSchema>;
export type StartRunCommand = z.infer<typeof startOrchestrationRunSchema>;

export type NodeRunInput = {
  run: RunSnapshot;
  requirement: string;
};

export type NodeRunResult = {
  stateKey: string;
  artifact: unknown;
  review?: {
    verdict: 'pass' | 'revise' | 'escalate';
    summary: string;
    reasons: string[];
  };
};
