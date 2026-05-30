interface AssetCandidate {
  id: string;
  action: 'add' | 'update' | 'deprecate';
  targetType: 'asset_card' | 'relationship_edge';
  targetId: string;
  payload: Record<string, unknown>;
  sourceRefs: string[];
  autoApply: boolean;
  reason?: string;
}

export function extractAssetCandidates(
  artifact: Record<string, unknown>,
  existing: Array<{ id: string; [k: string]: unknown }>,
): AssetCandidate[] {
  const candidates: AssetCandidate[] = [];
  const existingMap = new Map(existing.map((e) => [e.id, e]));

  const cards = artifact.asset_cards;
  if (Array.isArray(cards)) {
    for (const card of cards) {
      if (!card || typeof card !== 'object' || !('id' in card)) continue;
      const c = card as Record<string, unknown>;
      const id = c.id as string;
      const ex = existingMap.get(id);
      if (ex) {
        const locked = (ex as any).status === 'locked';
        candidates.push({
          id: `patch_${id}`, action: 'update', targetType: 'asset_card',
          targetId: id, payload: c, sourceRefs: (c.sourceRefs as string[]) ?? [],
          autoApply: !locked, ...(locked ? { reason: 'locked' } : {}),
        });
      } else {
        candidates.push({
          id: `patch_${id}`, action: 'add', targetType: 'asset_card',
          targetId: id, payload: c, sourceRefs: (c.sourceRefs as string[]) ?? [],
          autoApply: true,
        });
      }
    }
  }

  const graph = artifact.relationship_graph as any;
  if (graph?.edges && Array.isArray(graph.edges)) {
    for (const edge of graph.edges) {
      if (!edge || !edge.id) continue;
      candidates.push({
        id: `patch_${edge.id}`, action: 'add', targetType: 'relationship_edge',
        targetId: edge.id, payload: edge, sourceRefs: [],
        autoApply: true,
      });
    }
  }

  return candidates;
}

export function classifyPatches(candidates: AssetCandidate[]): { autoApply: AssetCandidate[]; needsReview: AssetCandidate[] } {
  return {
    autoApply: candidates.filter((c) => c.autoApply),
    needsReview: candidates.filter((c) => !c.autoApply),
  };
}
