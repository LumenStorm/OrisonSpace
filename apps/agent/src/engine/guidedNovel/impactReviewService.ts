import { guidedImpactReviewSchema } from '@orison/shared-contracts';
import type { GuidedImpactReview } from '@orison/shared-contracts';

export type GuidedImpactInput = {
  field: string;
  upcomingPhaseIds?: string[];
  upcomingChapterIds?: string[];
  affectedAssetIds?: string[];
};

const REPLAN_FIELDS = new Set([
  'outline_v2',
  'world_setting',
  'relationship_graph',
  'growth_curve',
  'pacing_curve',
  'emotion_curve',
]);

export function buildImpactReview(input: GuidedImpactInput): GuidedImpactReview {
  const affectedChapterIds = input.upcomingChapterIds ?? [];
  const recommendation =
    REPLAN_FIELDS.has(input.field) || affectedChapterIds.length > 1 ? 'replan' : 'continue';

  return guidedImpactReviewSchema.parse({
    triggerField: input.field,
    affectedPhaseIds: input.upcomingPhaseIds ?? [],
    affectedChapterIds,
    affectedAssetIds: input.affectedAssetIds ?? [],
    summary: buildSummary(input.field, affectedChapterIds.length),
    recommendation,
  });
}

function buildSummary(field: string, chapterCount: number) {
  if (chapterCount === 0) {
    return `${field} changed, but no upcoming chapters are currently linked.`;
  }
  return `${field} changed and may affect ${chapterCount} upcoming chapter(s).`;
}
