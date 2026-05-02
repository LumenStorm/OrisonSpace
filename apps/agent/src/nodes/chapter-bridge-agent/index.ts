import type { OrchestrationNode } from '../base';
import type { NodeRunInput, NodeRunResult } from '../../contracts/run';

/**
 * 章节桥接节点：基于前序章节的结尾和摘要，
 * 为当前章节生成衔接指南（bridge notes）。
 *
 * 不依赖 AI — 纯规则计算。
 * 对接续写作模式（continue/polish）提供上下文延续指导。
 */
export function createChapterBridgeNode(): OrchestrationNode {
  return {
    id: 'chapter-bridge-agent',
    async run(input: NodeRunInput): Promise<NodeRunResult> {
      const context = input.run.artifacts?.['context.chapterContext'] as Record<string, any> | undefined;

      const previousTail = (context?.previousChapterTail as string) ?? '';
      const recentSummaries = (context?.recentSummaries as Array<{ title: string; summary: string }>) ?? [];
      const draftText = (context?.draftText as string) ?? '';
      const chapterNumber = (context?.chapterNumber as number) ?? 1;
      const chapterTitle = (context?.targetChapterTitle as string) ?? `第${chapterNumber}章`;

      // 构建桥接指南
      const bridgeGuidance: {
        chapterTitle: string;
        chapterNumber: number;
        isFirstChapter: boolean;
        previousChapterEnding: string | null;
        previousSummaries: Array<{ title: string; summary: string }>;
        existingDraftLength: number;
        carryOverNotes: string;
      } = {
        chapterTitle,
        chapterNumber,
        isFirstChapter: chapterNumber <= 1,
        previousChapterEnding: previousTail || null,
        previousSummaries: recentSummaries,
        existingDraftLength: draftText.length,
        carryOverNotes: '',
      };

      // 生成延续指导
      if (chapterNumber <= 1) {
        bridgeGuidance.carryOverNotes = '这是第一章，无需衔接上一章。直接开始叙述。';
      } else if (previousTail) {
        bridgeGuidance.carryOverNotes =
          `承接上一章结尾（最后150字）："${previousTail.slice(-150)}"。\n` +
          `上一章摘要：${recentSummaries[recentSummaries.length - 1]?.summary ?? '无'}。\n` +
          `请自然延续上一章的叙事节奏和氛围。`;
      } else {
        bridgeGuidance.carryOverNotes =
          `上一章摘要：${recentSummaries[recentSummaries.length - 1]?.summary ?? '无'}。\n` +
          `请基于摘要延续故事。`;
      }

      return {
        stateKey: 'context.bridgeGuidance',
        artifact: bridgeGuidance,
      };
    },
  };
}
