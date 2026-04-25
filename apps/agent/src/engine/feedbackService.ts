import crypto from 'node:crypto';
import type { RunSnapshot } from '../contracts/run';
import type { AssetPatchCandidate } from '@orison/shared-contracts';
import { extractAssetCandidates, classifyPatches } from './assetLibrary';

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

/**
 * 从 creative run 产物中提取结构化的 AssetPatchCandidate。
 * 使用 assetLibrary 的 extractAssetCandidates + classifyPatches。
 */
export function buildCreativeFeedback(run: RunSnapshot): {
  feedbackId: string;
  createdAt: string;
  candidates: AssetPatchCandidate[];
  autoApply: AssetPatchCandidate[];
  needsReview: AssetPatchCandidate[];
  memo: string;
} {
  const assetOutput = run.artifacts['assets.projectContext'] as Record<string, unknown> | undefined;

  // 提取资产卡候选补丁
  const existingCards: Array<{ id: string; type: string; name: string; status?: string }> = [];
  const candidates: AssetPatchCandidate[] = [];

  if (assetOutput) {
    const extracted = extractAssetCandidates(assetOutput, existingCards);
    candidates.push(...extracted);
  }

  const { autoApply, needsReview } = classifyPatches(candidates);

  const memo = run.review
    ? `审核结论: ${run.review.verdict ?? 'none'} — ${run.review.summary}。共 ${candidates.length} 个资产补丁（${autoApply.length} 自动，${needsReview.length} 需审核）`
    : `无审核记录。共 ${candidates.length} 个资产补丁`;

  return {
    feedbackId: `fb_${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    candidates,
    autoApply,
    needsReview,
    memo
  };
}
