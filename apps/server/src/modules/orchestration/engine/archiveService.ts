import crypto from 'node:crypto';
import type { RunSnapshot } from '../contracts/run';

export function createArchiveRecord(run: RunSnapshot) {
  return {
    versionId: `ver_${crypto.randomUUID()}`,
    archivedAt: new Date().toISOString(),
    promptFiles: run.completedNodes.map(
      (nodeId) => `project-config/prompts/${nodeId}.yaml`
    )
  };
}
