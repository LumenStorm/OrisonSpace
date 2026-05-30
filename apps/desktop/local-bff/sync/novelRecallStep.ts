import type { TagCategory } from '@orison/shared-contracts';
import { recallMemories, formatRecalledMemories } from './memoryRecall';
import { loadTagRegistry, normalizeTag } from './tagRegistry';

export interface RecallTagInput {
  category: TagCategory;
  value: string;
  reason?: string;
}

export interface NovelRecallStepInput {
  projectPath: string;
  novelId: string;
  currentChapter: number;
  recallTags: RecallTagInput[];
  maxTokenBudget?: number;
}

export interface NovelRecallStepOutput {
  recalledMemoriesText: string;
  entryCount: number;
  totalTokens: number;
  truncated: boolean;
}

/**
 * 章节生成循环中的记忆召回步骤。
 * 在 chapter_task_agent 输出 recallTags 后、novel_draft_writer_agent 执行前调用。
 * 返回格式化的召回文本，注入 artifacts["context.recalledMemories"]。
 */
export function executeRecallStep(input: NovelRecallStepInput): NovelRecallStepOutput {
  const { projectPath, novelId, currentChapter, recallTags, maxTokenBudget } = input;

  const registry = loadTagRegistry(projectPath, novelId);
  const normalizedTags = recallTags.map(t => ({
    category: t.category,
    value: normalizeTag(registry, t.category, t.value),
  }));

  const result = recallMemories(projectPath, novelId, {
    tags: normalizedTags,
    maxTokenBudget: maxTokenBudget ?? 2000,
    currentChapter,
  });

  return {
    recalledMemoriesText: formatRecalledMemories(result.entries),
    entryCount: result.entries.length,
    totalTokens: result.totalTokens,
    truncated: result.truncated,
  };
}
