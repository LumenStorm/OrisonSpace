import type { FieldPatchEntry } from '@orison/shared-contracts';

/**
 * Story-sync 规则驱动实现（与 LLM 模式同形输出）。
 *
 * 输入：
 *  - chapterId / content / chapterNumber 来自 chapter.candidate
 *  - existingForeshadow / foreshadowVersion 来自 context.chapterContext
 *
 * 输出：
 *  - patches[]：白名单字段、merge action、含 fieldVersion 与 generatedBy
 *
 * 设计：纯函数，便于在 LLM 失败时直接 fallback。不读 IO、不抛异常。
 */
export type StorySyncRulesInput = {
  chapterId: string;
  content: string;
  chapterNumber?: number | string | null;
  existingForeshadow: Array<Record<string, any>>;
  foreshadowVersion: number;
};

export type StorySyncRulesOutput = {
  patches: FieldPatchEntry[];
};

const cuePatterns: Array<{ keyword: RegExp; title: string; category: string }> = [
  { keyword: /铜?钥匙/u, title: '钥匙线索', category: 'item' },
  { keyword: /信件|纸条|遗书/u, title: '信件线索', category: 'item' },
  { keyword: /照片|相片|画像/u, title: '影像线索', category: 'item' },
  { keyword: /匣子|盒子|木匣/u, title: '匣子线索', category: 'item' },
  { keyword: /印记|刺青|纹身/u, title: '身体印记', category: 'identity' },
];

export function deriveStorySyncByRules(input: StorySyncRulesInput): StorySyncRulesOutput {
  const { chapterId, content, chapterNumber, existingForeshadow, foreshadowVersion } = input;
  const chapterRef = chapterId ? `chapter:${chapterId}` : 'chapter:current';

  const newForeshadowItems: Array<Record<string, unknown>> = [];
  for (const cue of cuePatterns) {
    if (!cue.keyword.test(content)) continue;

    const dup = existingForeshadow.some((it) => {
      const haystack = `${it.title ?? ''} ${it.content ?? ''} ${(it.tags ?? []).join(' ')}`;
      return cue.keyword.test(haystack);
    });
    if (dup) continue;

    newForeshadowItems.push({
      id: `fs_${chapterId || 'auto'}_${cue.category}_${newForeshadowItems.length + 1}`,
      title: cue.title,
      content: `第${chapterNumber ?? '?'}章出现的${cue.title}，等待回收。`,
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

  const patches: FieldPatchEntry[] = [];
  if (newForeshadowItems.length > 0) {
    patches.push({
      field: 'foreshadow_registry',
      action: 'merge',
      data: { items: newForeshadowItems },
      fieldVersion: foreshadowVersion,
      generatedBy: 'story-sync-agent',
    });
  }

  return { patches };
}
