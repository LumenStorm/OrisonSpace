import crypto from 'node:crypto';
import type { AssetPatchCandidate } from '@orison/shared-contracts';

type AssetCard = {
  id: string;
  type: string;
  name: string;
  status?: string;
  [key: string]: unknown;
};

/**
 * 从 artifact 中提取资产候选补丁
 */
export function extractAssetCandidates(
  artifact: Record<string, unknown>,
  existingCards: AssetCard[]
): AssetPatchCandidate[] {
  const candidates: AssetPatchCandidate[] = [];
  const existingIds = new Set(existingCards.map((c) => c.id));

  // 从 asset_cards 类型的 artifact 中提取
  const cards = artifact.asset_cards as AssetCard[] | undefined;
  if (Array.isArray(cards)) {
    for (const card of cards) {
      if (!card.id || !card.name) continue;

      const action = existingIds.has(card.id) ? 'update' : 'add';
      const existing = existingCards.find((c) => c.id === card.id);
      const isLocked = existing?.status === 'locked';

      candidates.push({
        id: `patch_${crypto.randomUUID()}`,
        action,
        targetType: 'asset_card',
        targetId: card.id,
        payload: card,
        sourceRefs: (card.sourceRefs as string[]) ?? [],
        autoApply: !isLocked,
        reason: action === 'add' ? `新发现资产: ${card.name}` : `更新资产: ${card.name}`
      });
    }
  }

  // 从 relationship_graph edges 中提取
  const edges = (artifact.relationship_graph as { edges?: Array<Record<string, unknown>> })?.edges;
  if (Array.isArray(edges)) {
    for (const edge of edges) {
      if (!edge.id || !edge.from || !edge.to) continue;

      candidates.push({
        id: `patch_${crypto.randomUUID()}`,
        action: 'add',
        targetType: 'relationship_edge',
        targetId: edge.id as string,
        payload: edge,
        sourceRefs: (edge.sourceRefs as string[]) ?? [],
        autoApply: !(edge.locked as boolean),
        reason: `新发现关系: ${edge.from} -> ${edge.to}`
      });
    }
  }

  return candidates;
}

/**
 * 分类补丁：auto-apply 或 needs-review
 */
export function classifyPatches(candidates: AssetPatchCandidate[]): {
  autoApply: AssetPatchCandidate[];
  needsReview: AssetPatchCandidate[];
} {
  const autoApply: AssetPatchCandidate[] = [];
  const needsReview: AssetPatchCandidate[] = [];

  for (const c of candidates) {
    if (c.autoApply) {
      autoApply.push(c);
    } else {
      needsReview.push(c);
    }
  }

  return { autoApply, needsReview };
}
