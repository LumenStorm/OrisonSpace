import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { RunSnapshot } from '../contracts/run';
import type { RunResult } from './runService';

export function createCreativeArchiveRecord(run: RunResult, configRoot: string) {
  const dir = path.join(configRoot, 'runs', run.runId, 'artifacts');
  const artifactFiles = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.yaml'))
    : [];

  return {
    versionId: `ver_${Date.now().toString(36)}`,
    archivedAt: new Date().toISOString(),
    artifactFiles,
    completedNodes: run.completedNodes,
  };
}

export function createArchiveRecord(run: RunSnapshot) {
  return {
    versionId: `ver_${Date.now().toString(36)}`,
    archivedAt: new Date().toISOString(),
    promptFiles: run.completedNodes.map((n) => `prompts/${n}.yaml`),
  };
}
