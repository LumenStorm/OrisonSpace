import { guidedChapterTaskCardSchema } from '@orison/shared-contracts';
import type { AssetCard, GuidedChangeChecklist, GuidedChapterTaskCard, WorldSetting } from '@orison/shared-contracts';
import { runNovelPipeline } from '../novelPipeline';
import { deriveGuidedChangeChecklist } from './changeReviewService';

export type GuidedChapterCycleInput = {
  projectPath: string;
  chapterId: string;
  instruction: string;
  assetCards: AssetCard[];
  worldSetting?: WorldSetting | null;
  reviewMode?: 'pass' | 'revise' | 'escalate';
  forcePythonFailure?: boolean;
};

export type GuidedChapterCycleResult = {
  taskCard: GuidedChapterTaskCard;
  run: Awaited<ReturnType<typeof runNovelPipeline>>;
  checklist: GuidedChangeChecklist;
};

export async function runGuidedChapterCycle(
  input: GuidedChapterCycleInput,
): Promise<GuidedChapterCycleResult> {
  const taskCard = guidedChapterTaskCardSchema.parse({
    chapterId: input.chapterId,
    summary: input.instruction,
    goal: input.instruction,
    involvedAssetIds: input.assetCards.map((asset) => asset.id),
    storyBeats: [],
  });

  const run = await runNovelPipeline({
    projectPath: input.projectPath,
    chapterId: input.chapterId,
    mode: 'generate',
    instruction: input.instruction,
    reviewMode: input.reviewMode ?? 'pass',
    forcePythonFailure: input.forcePythonFailure ?? false,
  });

  const chapterText = extractChapterText(run.artifacts);
  const checklist = deriveGuidedChangeChecklist({
    chapterId: input.chapterId,
    chapterText,
    currentAssets: input.assetCards,
    currentWorldSetting: input.worldSetting,
  });

  return {
    taskCard,
    run,
    checklist,
  };
}

function extractChapterText(artifacts: Record<string, unknown>) {
  const draft = artifacts['chapter_candidate'] as Record<string, unknown> | undefined;
  if (draft && typeof draft.content === 'string') {
    return draft.content;
  }

  const nested = draft?.candidate as Record<string, unknown> | undefined;
  return typeof nested?.content === 'string' ? nested.content : '';
}
