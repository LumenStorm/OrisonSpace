import crypto from 'node:crypto';
import type { RunSnapshot } from '../contracts/run';

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
