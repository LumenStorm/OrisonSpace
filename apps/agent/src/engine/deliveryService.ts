import crypto from 'node:crypto';
import type { RunSnapshot } from '../contracts/run';
import type { ProjectFieldPatch, CreativeFieldKey, CreativeRunContext } from '@orison/shared-contracts';

export function buildDeliveryOutput(run: RunSnapshot) {
  const draft = run.artifacts['draft.initial'] ?? run.artifacts['draft.revision'] ?? null;
  const storyPlan = run.artifacts['planning.storyPlan'] ?? null;
  const reviewResult = run.artifacts['review.latest'] ?? null;

  return {
    deliveryId: `dlv_${crypto.randomUUID()}`,
    deliveredAt: new Date().toISOString(),
    format: 'json' as const,
    content: {
      ...(storyPlan ? { storyPlan } : {}),
      ...(draft ? { draft } : {}),
      ...(reviewResult ? { review: reviewResult } : {})
    },
    summary: `交付包含 ${Object.keys(run.artifacts).length} 个产物，共 ${run.completedNodes.length} 个节点完成`
  };
}

/**
 * stateKey → CreativeFieldKey 映射表。
 * 复合产物（assets.projectContext、curves）需要拆分为多个字段。
 */
type FieldMapping = {
  field: CreativeFieldKey;
  extract?: (artifact: unknown) => unknown;
};

const STATE_KEY_MAPPINGS: Record<string, FieldMapping[]> = {
  'intake.requirement': [{ field: 'creative_brief' }],
  'assets.projectContext': [
    { field: 'world_setting', extract: (a: any) => a?.world_setting },
    { field: 'asset_cards', extract: (a: any) => a?.asset_cards },
    { field: 'relationship_graph', extract: (a: any) => a?.relationship_graph }
  ],
  'planning.storyPlan': [{ field: 'outline' }],
  'curves': [
    { field: 'growth_curve', extract: (a: any) => a?.growth_curve },
    { field: 'pacing_curve', extract: (a: any) => a?.pacing_curve },
    { field: 'emotion_curve', extract: (a: any) => a?.emotion_curve }
  ],
  'episode_outlines': [{ field: 'episode_outlines' }]
};

/** stateKey → 生成该产物的节点 ID */
const STATE_KEY_TO_NODE: Record<string, string> = {
  'intake.requirement': 'intake-agent',
  'assets.projectContext': 'asset-loader-agent',
  'planning.storyPlan': 'story-planner-agent',
  'curves': 'curve-planner-agent',
  'episode_outlines': 'episode-planner-agent'
};

/**
 * 从 creative run 产物生成项目字段 patch。
 * 将 run.artifacts 中的 stateKey 映射为 CreativeFieldKey 级别的 patch 条目。
 */
export function buildCreativeDelivery(
  run: RunSnapshot,
  context: CreativeRunContext
): ProjectFieldPatch {
  const patches: ProjectFieldPatch['patches'] = [];

  for (const [stateKey, artifact] of Object.entries(run.artifacts)) {
    const mappings = STATE_KEY_MAPPINGS[stateKey];
    if (!mappings) continue;

    for (const mapping of mappings) {
      const data = mapping.extract ? mapping.extract(artifact) : artifact;
      if (data == null) continue;

      patches.push({
        field: mapping.field,
        action: 'set',
        data,
        fieldVersion: (context.fieldVersions[mapping.field] ?? 0) + 1,
        generatedBy: STATE_KEY_TO_NODE[stateKey] ?? 'unknown'
      });
    }
  }

  return {
    runId: run.runId,
    createdAt: new Date().toISOString(),
    patches
  };
}
