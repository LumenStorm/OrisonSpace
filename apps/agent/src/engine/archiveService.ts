import crypto from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { RunSnapshot } from '../contracts/run';
import type { CreativeRunContext } from '@orison/shared-contracts';

export function createArchiveRecord(run: RunSnapshot) {
  return {
    versionId: `ver_${crypto.randomUUID()}`,
    archivedAt: new Date().toISOString(),
    promptFiles: run.completedNodes.map(
      (nodeId) => `project-config/prompts/${nodeId}.yaml`
    )
  };
}

/**
 * 创建 creative run 的归档记录，关联实际落盘的 YAML 产物文件。
 */
export function createCreativeArchiveRecord(
  run: RunSnapshot,
  configRoot: string,
  context?: CreativeRunContext
) {
  const artifactDir = path.join(configRoot, 'runs', run.runId, 'artifacts');
  let artifactFiles: string[] = [];

  if (existsSync(artifactDir)) {
    artifactFiles = readdirSync(artifactDir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => path.join('runs', run.runId, 'artifacts', f));
  }

  const fieldVersions: Record<string, number> = {};
  if (context) {
    for (const [key, version] of Object.entries(context.fieldVersions)) {
      fieldVersions[key] = version;
    }
  }

  return {
    versionId: `ver_${crypto.randomUUID()}`,
    archivedAt: new Date().toISOString(),
    promptFiles: run.completedNodes.map(
      (nodeId) => `prompts/${nodeId}.yaml`
    ),
    artifactFiles,
    fieldVersions
  };
}
