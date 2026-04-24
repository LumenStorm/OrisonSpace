import crypto from 'node:crypto';
import type { RunSnapshot } from '../contracts/run';

type AssetPatch = {
  target: 'asset' | 'rule' | 'prompt';
  key: string;
  value: unknown;
};

export function buildFeedback(run: RunSnapshot) {
  const patches: AssetPatch[] = [];

  // 从 review 中提取规则更新
  if (run.review && run.review.reasons.length > 0) {
    patches.push({
      target: 'rule',
      key: 'review.lessons',
      value: run.review.reasons
    });
  }

  // 从 continuity memory 中提取资产更新
  const continuity = run.artifacts['memory.continuity'];
  if (continuity) {
    patches.push({
      target: 'asset',
      key: 'memory.continuity',
      value: continuity
    });
  }

  const memo = run.review
    ? `审核结论: ${run.review.verdict ?? 'none'} — ${run.review.summary}`
    : '无审核记录';

  return {
    feedbackId: `fb_${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    assetPatches: patches,
    memo
  };
}
