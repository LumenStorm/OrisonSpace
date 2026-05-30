import type { RunSnapshot } from '../contracts/run';

export function buildFeedback(run: RunSnapshot) {
  const assetPatches: Array<{ target: 'asset' | 'rule' | 'prompt'; key: string; value: unknown }> = [];

  // Extract from continuity memory
  const memory = run.artifacts['memory.continuity'] as any;
  if (memory?.rules) {
    for (const rule of memory.rules) {
      assetPatches.push({ target: 'asset', key: 'continuity_rule', value: rule });
    }
  }

  // Extract rule patches from review reasons
  const review = run.review;
  if (review?.reasons) {
    for (const reason of review.reasons) {
      assetPatches.push({ target: 'rule', key: reason, value: reason });
    }
  }

  let memo = '';
  if (!review) {
    memo = '无审核记录';
  } else {
    memo = `verdict: ${review.verdict ?? 'none'} — ${review.summary ?? ''}`;
  }

  return {
    feedbackId: `fb_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    assetPatches,
    memo,
  };
}
