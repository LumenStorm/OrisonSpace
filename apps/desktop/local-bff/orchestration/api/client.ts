import type { z } from 'zod';
import {
  orchestrationRunSchema,
  startOrchestrationRunSchema,
  DEFAULT_API_BASE
} from '@orison/shared-contracts';

type StartRunCommand = z.infer<typeof startOrchestrationRunSchema>;
type RunSnapshot = z.infer<typeof orchestrationRunSchema>;

const BASE_URL = DEFAULT_API_BASE;

export function createOrchestrationClient() {
  return {
    async startRun(command: StartRunCommand): Promise<RunSnapshot> {
      const response = await fetch(`${BASE_URL}/v1/orchestration/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(startOrchestrationRunSchema.parse(command))
      });

      if (!response.ok) {
        throw new Error(`Failed to start orchestration run: ${response.status}`);
      }

      return orchestrationRunSchema.parse(await response.json());
    },
    async getRun(runId: string): Promise<RunSnapshot> {
      const response = await fetch(`${BASE_URL}/v1/orchestration/runs/${encodeURIComponent(runId)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch orchestration run: ${response.status}`);
      }

      return orchestrationRunSchema.parse(await response.json());
    }
  };
}
