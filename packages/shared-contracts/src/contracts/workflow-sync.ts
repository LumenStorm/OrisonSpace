import crypto from 'node:crypto';
import type { FieldDependencyGraph, WorkflowSyncEvent } from './agent-contract';
import { creativeFieldKeys, type CreativeFieldKey } from './creative-fields';

// ── 硬编码依赖图 ──
// upstream 变化 → downstream 需要重算

const DEPENDENCY_EDGES: { upstream: CreativeFieldKey; downstream: CreativeFieldKey }[] = [
  { upstream: 'asset_cards', downstream: 'world_setting' },
  { upstream: 'asset_cards', downstream: 'outline' },
  { upstream: 'asset_cards', downstream: 'growth_curve' },
  { upstream: 'asset_cards', downstream: 'pacing_curve' },
  { upstream: 'asset_cards', downstream: 'emotion_curve' },
  { upstream: 'asset_cards', downstream: 'foreshadow_registry' },
  { upstream: 'asset_cards', downstream: 'episode_outlines' },
  { upstream: 'relationship_graph', downstream: 'world_setting' },
  { upstream: 'relationship_graph', downstream: 'outline' },
  { upstream: 'relationship_graph', downstream: 'growth_curve' },
  { upstream: 'relationship_graph', downstream: 'pacing_curve' },
  { upstream: 'relationship_graph', downstream: 'emotion_curve' },
  { upstream: 'relationship_graph', downstream: 'foreshadow_registry' },
  { upstream: 'relationship_graph', downstream: 'episode_outlines' },
  { upstream: 'world_setting', downstream: 'outline' },
  { upstream: 'world_setting', downstream: 'growth_curve' },
  { upstream: 'world_setting', downstream: 'pacing_curve' },
  { upstream: 'world_setting', downstream: 'emotion_curve' },
  { upstream: 'world_setting', downstream: 'foreshadow_registry' },
  { upstream: 'world_setting', downstream: 'episode_outlines' },
  { upstream: 'outline', downstream: 'growth_curve' },
  { upstream: 'outline', downstream: 'pacing_curve' },
  { upstream: 'outline', downstream: 'emotion_curve' },
  { upstream: 'outline', downstream: 'foreshadow_registry' },
  { upstream: 'outline', downstream: 'episode_outlines' },
  { upstream: 'growth_curve', downstream: 'episode_outlines' },
  { upstream: 'pacing_curve', downstream: 'episode_outlines' },
  { upstream: 'emotion_curve', downstream: 'episode_outlines' },
  { upstream: 'foreshadow_registry', downstream: 'episode_outlines' }
];

export function getDefaultDependencyGraph(): FieldDependencyGraph {
  return { edges: [...DEPENDENCY_EDGES] };
}

export function computeAffectedFields(changedField: CreativeFieldKey): CreativeFieldKey[] {
  const affected = new Set<CreativeFieldKey>();
  const queue: CreativeFieldKey[] = [changedField];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of DEPENDENCY_EDGES) {
      if (edge.upstream === current && !affected.has(edge.downstream)) {
        affected.add(edge.downstream);
        queue.push(edge.downstream);
      }
    }
  }

  return [...affected];
}

export function createSyncEvent(params: {
  source: 'user' | 'agent' | 'sync';
  field: CreativeFieldKey;
  entityId?: string;
  fromVersion: number;
  toVersion: number;
  reason: string;
}): WorkflowSyncEvent {
  return {
    id: `evt_${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    source: params.source,
    field: params.field,
    entityId: params.entityId,
    fromVersion: params.fromVersion,
    toVersion: params.toVersion,
    reason: params.reason,
    affectedFields: computeAffectedFields(params.field)
  };
}

export function markStaleFields(
  currentStale: CreativeFieldKey[],
  changedField: CreativeFieldKey
): CreativeFieldKey[] {
  const affected = computeAffectedFields(changedField);
  const merged = new Set([...currentStale, ...affected]);
  return [...merged];
}

export function initFieldVersions(): Record<CreativeFieldKey, number> {
  const versions = {} as Record<CreativeFieldKey, number>;
  for (const key of creativeFieldKeys) {
    versions[key] = 0;
  }
  return versions;
}
