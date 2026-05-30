import type { RunSnapshot } from '../contracts/run';

export function createArchiveRecord(run: RunSnapshot) {
  return {
    versionId: `ver_${Date.now().toString(36)}`,
    archivedAt: new Date().toISOString(),
    promptFiles: run.completedNodes.map((n) => `prompts/${n}.yaml`),
  };
}
