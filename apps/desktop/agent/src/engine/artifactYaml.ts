import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { AgentContract } from '@orison/shared-contracts';

export function writeArtifactYaml(
  root: string, runId: string, fieldName: string, artifact: unknown,
  meta: { schema_version?: number; field_version?: number; generated_by?: string; source_refs?: string[] } = {},
): string {
  const dir = path.join(root, 'runs', runId, 'artifacts');
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${fieldName}.yaml`);
  const doc = {
    meta: {
      schema_version: meta.schema_version ?? 1,
      field_version: meta.field_version ?? 1,
      generated_by: meta.generated_by ?? 'agent',
      source_refs: meta.source_refs ?? [],
    },
    data: artifact,
  };
  writeFileSync(filePath, YAML.stringify(doc), 'utf8');
  return filePath;
}

export function readArtifactYaml(root: string, runId: string, fieldName: string): { meta: any; data: any } | null {
  const filePath = path.join(root, 'runs', runId, 'artifacts', `${fieldName}.yaml`);
  if (!existsSync(filePath)) return null;
  const parsed = YAML.parse(readFileSync(filePath, 'utf8'));
  return { meta: parsed.meta, data: parsed.data };
}

export function buildContextPacket(
  contract: AgentContract,
  artifacts: Record<string, unknown>,
  versions: Record<string, number>,
  runId: string,
): { run_id: string; node_id: string; fields: Record<string, unknown>; field_versions: Record<string, number> } {
  const fields: Record<string, unknown> = {};
  const fieldVersions: Record<string, number> = {};
  for (const key of contract.reads) {
    if (key in artifacts) fields[key] = artifacts[key];
    fieldVersions[key] = versions[key] ?? 0;
  }
  return { run_id: runId, node_id: contract.id, fields, field_versions: fieldVersions };
}

export function writeContextPacketYaml(root: string, runId: string, nodeId: string, packet: unknown): string {
  const dir = path.join(root, 'runs', runId, 'context-packets');
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${nodeId}.yaml`);
  writeFileSync(filePath, YAML.stringify(packet), 'utf8');
  return filePath;
}
