import type { OrchestrationNode } from '../base';
import type { NodeRunInput, NodeRunResult } from '../../contracts/run';

/**
 * 章节标题节点：从候选文本生成标题和摘要。
 *
 * 基于 draft-writer 产出的文本和上下文信息，
 * 产出最终的 chapter_candidate 元数据（title + summary）。
 */
export function createChapterTitleNode(): OrchestrationNode {
  return {
    id: 'chapter-title-agent',
    async run(input: NodeRunInput): Promise<NodeRunResult> {
      // 优先使用修订版，其次使用初稿
      const draftArtifact =
        (input.run.artifacts?.['draft.revision'] as Record<string, any> | undefined) ??
        (input.run.artifacts?.['draft.initial'] as Record<string, any> | undefined);
      const context = input.run.artifacts?.['context.chapterContext'] as Record<string, any> | undefined;

      const draftTitle = (draftArtifact?.title as string) ?? '';
      const draftText = (draftArtifact?.text as string) ?? '';
      const wordCount = (draftArtifact?.wordCount as number) ?? draftText.length;
      const chapterId = (context?.chapterId as string) ?? '';
      const chapterNumber = (context?.chapterNumber as number) ?? 1;

      // 规范化标题：
      // - 若 draft title 已经包含任意 "第X章" 前缀，直接保留作为最终 title（不再加章节号）。
      // - 否则用当前章节号补全前缀。
      const trimmed = draftTitle.trim();
      const anyChapterPrefix = /^第\s*\d+\s*章\s*/u;
      let finalTitle: string;
      if (anyChapterPrefix.test(trimmed)) {
        finalTitle = trimmed;
      } else if (trimmed) {
        finalTitle = `第${chapterNumber}章 ${trimmed}`;
      } else {
        finalTitle = `第${chapterNumber}章`;
      }

      // 生成摘要（取文章开头 200 字 + 关键信息）
      const summary = draftText.slice(0, 200).replace(/\n/g, ' ').trim();

      const candidate = {
        title: finalTitle,
        content: draftText,
        summary: summary || `第${chapterNumber}章内容`,
        wordCount,
        chapterId,
      };

      return {
        stateKey: 'chapter.candidate',
        artifact: candidate,
      };
    },
  };
}
