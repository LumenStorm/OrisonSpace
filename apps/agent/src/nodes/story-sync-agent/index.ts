import type { OrchestrationNode } from '../base';
import type { NodeRunInput, NodeRunResult } from '../../contracts/run';

/**
 * Story Sync Agent (TS, 规则驱动)
 *
 * 输入：
 *  - context.chapterContext  (assetCards, foreshadowRegistry, novelTitle, ...)
 *  - chapter.candidate       (title, content, summary, wordCount)
 *
 * 输出：state_key = 'story.sync'
 *  {
 *    runId, chapterId, summary,
 *    patches: ProjectFieldPatch.patches[]
 *  }
 *
 * 设计要点：
 *  1. 不调用 LLM —— 在 Phase 4 这一阶段用启发式规则即可，方便审阅与回归。
 *     Phase 6/7 可以无侵入升级到 Python AI 节点（替换实现，不改契约）。
 *  2. 永远不会"覆盖"已有 locked 字段：
 *     - 默认所有 patch 走 `merge` action（叠加，不替换）。
 *     - 若 chapter 中提到的 foreshadow id 已在 registry 中存在 -> 不重复创建。
 *  3. 输出 patches 只能引用 `creativeFieldKeys` 白名单字段。
 */
export function createStorySyncNode(): OrchestrationNode {
  return {
    id: 'story-sync-agent',
    async run(input: NodeRunInput): Promise<NodeRunResult> {
      const ctx = input.run.artifacts?.['context.chapterContext'] as Record<string, any> | undefined;
      const candidate = input.run.artifacts?.['chapter.candidate'] as Record<string, any> | undefined;
      const runId = input.run.runId;

      if (!candidate || !candidate.content) {
        return {
          stateKey: 'story.sync',
          artifact: {
            runId,
            chapterId: ctx?.chapterId ?? '',
            patches: [],
            summary: 'skip: no chapter candidate available',
          },
        };
      }

      const chapterId = (candidate.chapterId as string) ?? (ctx?.chapterId as string) ?? '';
      const content = (candidate.content as string) ?? '';
      const chapterRef = chapterId ? `chapter:${chapterId}` : 'chapter:current';

      const patches: Array<{
        field: string;
        action: 'set' | 'merge' | 'delete';
        data: unknown;
        fieldVersion: number;
        generatedBy: string;
      }> = [];

      // ── 启发式：从内容中提取潜在的 "新元素"（道具/线索） → 作为 foreshadow merge 候选
      // 关键词：钥匙/信件/照片/纸条/匣子/印记 等典型悬念物件
      const cuePatterns: Array<{ keyword: RegExp; title: string; category: string }> = [
        { keyword: /铜?钥匙/u, title: '钥匙线索', category: 'item' },
        { keyword: /信件|纸条|遗书/u, title: '信件线索', category: 'item' },
        { keyword: /照片|相片|画像/u, title: '影像线索', category: 'item' },
        { keyword: /匣子|盒子|木匣/u, title: '匣子线索', category: 'item' },
        { keyword: /印记|刺青|纹身/u, title: '身体印记', category: 'identity' },
      ];

      const existingForeshadow = (ctx?.foreshadowRegistry?.items ?? []) as Array<Record<string, any>>;
      const foreshadowVersion =
        typeof ctx?.foreshadowRegistry?.version === 'number' ? (ctx.foreshadowRegistry.version as number) : 0;

      const newForeshadowItems: Array<Record<string, unknown>> = [];
      for (const cue of cuePatterns) {
        if (!cue.keyword.test(content)) continue;

        // 检查是否已经存在同名/同关键词的 entry
        const dup = existingForeshadow.some((it) => {
          const haystack = `${it.title ?? ''} ${it.content ?? ''} ${(it.tags ?? []).join(' ')}`;
          return cue.keyword.test(haystack);
        });
        if (dup) continue;

        newForeshadowItems.push({
          id: `fs_${chapterId || 'auto'}_${cue.category}_${newForeshadowItems.length + 1}`,
          title: cue.title,
          content: `第${ctx?.chapterNumber ?? '?'}章出现的${cue.title}，等待回收。`,
          source_type: 'agent',
          plant_ref: chapterRef,
          status: 'planted',
          category: cue.category,
          importance: 0.6,
          strength: 6,
          subtlety: 5,
          urgency: 0,
          tags: ['auto-extracted'],
          related_asset_ids: [],
          related_foreshadow_ids: [],
          sourceRefs: [chapterRef],
          auto_remind: true,
          remind_before_units: 5,
          include_in_context: true,
        });
      }

      if (newForeshadowItems.length > 0) {
        patches.push({
          field: 'foreshadow_registry',
          action: 'merge',
          data: { items: newForeshadowItems },
          fieldVersion: foreshadowVersion,
          generatedBy: 'story-sync-agent',
        });
      }

      // ── 启发式：未来扩展点 —— 角色出场/关系演化等，本阶段保持空实现，避免误更新

      const summary = patches.length === 0
        ? 'no field updates derived from chapter candidate'
        : `derived ${patches.length} field patch(es) from chapter ${chapterId || '(unknown)'}`;

      return {
        stateKey: 'story.sync',
        artifact: {
          runId,
          chapterId,
          patches,
          summary,
        },
      };
    },
  };
}
