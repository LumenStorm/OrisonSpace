import type { RunSnapshot } from '../contracts/run';
import type { RunResult } from './runService';

export function buildDeliveryOutput(run: RunSnapshot) {
  const content: Record<string, unknown> = {};
  if (run.artifacts['draft.initial']) content.draft = run.artifacts['draft.initial'];
  if (run.artifacts['review.latest']) content.review = run.artifacts['review.latest'];

  return {
    deliveryId: `dlv_${Date.now().toString(36)}`,
    deliveredAt: new Date().toISOString(),
    format: 'json' as const,
    content,
    summary: `${run.completedNodes.length} nodes completed`,
  };
}

export function buildCreativeDelivery(run: RunResult, context: { runId: string }) {
  const patches: Array<{ field: string; action: string; data: unknown; fieldVersion: number; generatedBy: string }> = [];

  const FIELD_MAP: Record<string, string> = {
    'assets.projectContext': 'world_setting',
    'planning.storyPlan': 'outline',
    episode_outlines: 'episode_outlines',
    curves: 'curves_bundle',
  };

  const artifactFieldMap: Record<string, { field: string; data: unknown }> = {};

  // Extract world_setting from assets.projectContext
  const assets = run.artifacts['assets.projectContext'] as any;
  if (assets?.world_setting) {
    artifactFieldMap.world_setting = { field: 'world_setting', data: assets.world_setting };
  }
  if (assets?.asset_cards) {
    artifactFieldMap.asset_cards = { field: 'asset_cards', data: assets.asset_cards };
  }
  if (assets?.relationship_graph) {
    artifactFieldMap.relationship_graph = { field: 'relationship_graph', data: assets.relationship_graph };
  }

  // outline
  const plan = run.artifacts['planning.storyPlan'];
  if (plan) artifactFieldMap.outline = { field: 'outline', data: plan };

  // episode_outlines
  const eps = run.artifacts['episode_outlines'];
  if (eps) artifactFieldMap.episode_outlines = { field: 'episode_outlines', data: eps };

  // curves
  const curves = run.artifacts['curves'] as any;
  if (curves) {
    if (curves.growth_curve) artifactFieldMap.growth_curve = { field: 'growth_curve', data: curves.growth_curve };
    if (curves.pacing_curve) artifactFieldMap.pacing_curve = { field: 'pacing_curve', data: curves.pacing_curve };
    if (curves.emotion_curve) artifactFieldMap.emotion_curve = { field: 'emotion_curve', data: curves.emotion_curve };
  }

  for (const [, entry] of Object.entries(artifactFieldMap)) {
    patches.push({
      field: entry.field,
      action: 'set',
      data: entry.data,
      fieldVersion: 1,
      generatedBy: 'creative-run',
    });
  }

  return {
    runId: run.runId,
    createdAt: new Date().toISOString(),
    patches,
  };
}
