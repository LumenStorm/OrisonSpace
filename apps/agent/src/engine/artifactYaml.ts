import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { CreativeFieldKey, AgentContract } from '@orison/shared-contracts';

type ArtifactMeta = {
  schema_version: number;
  field_version: number;
  generated_by: string;
  source_refs: string[];
};

/**
 * 将 artifact 写入 YAML 文件
 */
export function writeArtifactYaml(
  projectConfigRoot: string,
  runId: string,
  fieldKey: string,
  artifact: unknown,
  meta: ArtifactMeta
): string {
  const dir = path.join(projectConfigRoot, 'runs', runId, 'artifacts');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${fieldKey}.yaml`);
  const content = {
    ...meta,
    data: artifact
  };

  writeFileSync(filePath, YAML.stringify(content), 'utf8');
  return filePath;
}

/**
 * 读取 YAML artifact 并返回解析后的对象
 */
export function readArtifactYaml(
  projectConfigRoot: string,
  runId: string,
  fieldKey: string
): { meta: ArtifactMeta; data: unknown } | null {
  const filePath = path.join(projectConfigRoot, 'runs', runId, 'artifacts', `${fieldKey}.yaml`);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf8');
  const parsed = YAML.parse(raw) as Record<string, unknown>;

  return {
    meta: {
      schema_version: parsed.schema_version as number,
      field_version: parsed.field_version as number,
      generated_by: parsed.generated_by as string,
      source_refs: parsed.source_refs as string[]
    },
    data: parsed.data
  };
}

/**
 * 构建下游 agent 的瘦身上下文包
 * 只包含该节点 reads 中声明的字段
 */
export function buildContextPacket(
  contract: AgentContract,
  artifacts: Record<string, unknown>,
  fieldVersions: Record<string, number>,
  runId: string
): Record<string, unknown> {
  const packet: Record<string, unknown> = {
    run_id: runId,
    node_id: contract.id,
    field_versions: {} as Record<string, number>,
    fields: {} as Record<string, unknown>
  };

  const versions = packet.field_versions as Record<string, number>;
  const fields = packet.fields as Record<string, unknown>;

  for (const fieldKey of contract.reads) {
    versions[fieldKey] = fieldVersions[fieldKey] ?? 0;
    if (artifacts[fieldKey] != null) {
      fields[fieldKey] = artifacts[fieldKey];
    }
  }

  return packet;
}

/**
 * 将 context packet 写入 YAML
 */
export function writeContextPacketYaml(
  projectConfigRoot: string,
  runId: string,
  nodeId: string,
  packet: Record<string, unknown>
): string {
  const dir = path.join(projectConfigRoot, 'runs', runId, 'context-packets');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${nodeId}.yaml`);
  writeFileSync(filePath, YAML.stringify(packet), 'utf8');
  return filePath;
}
