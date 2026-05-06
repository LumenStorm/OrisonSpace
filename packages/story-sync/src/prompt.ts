import type { GenerationMessage } from '@orison/shared-contracts';

export type StorySyncPromptInput = {
  runId: string;
  chapterId: string;
  candidate: Record<string, unknown>;
  context: Record<string, unknown>;
};

const SYSTEM_PROMPT = `你是 story-sync-agent，负责从已生成章节中提取需要同步回项目创作字段的"最小安全补丁"。

你必须只输出 JSON，不要输出 Markdown、解释或代码块。
输出 JSON 结构必须是：
{
  "runId": string,
  "chapterId": string,
  "patches": [
    {
      "field": "foreshadow_registry" | "asset_cards" | "relationship_graph" | "world_setting" | "outline" | "episode_outlines" | "growth_curve" | "pacing_curve" | "emotion_curve" | "creative_brief",
      "action": "merge",
      "data": object,
      "fieldVersion": number,
      "generatedBy": "story-sync-agent"
    }
  ],
  "summary": string
}

规则：
1. 只生成有明确章节证据支持的补丁；不确定则 patches=[]。
2. 只使用 action="merge"，不要 set/delete，避免覆盖 locked 内容。
3. 不得更新 creativeFieldKeys 以外的字段。
4. fieldVersion 必须使用上下文中对应字段的当前 version；找不到则使用 0。
5. 优先提取伏笔、道具、身份线索、关系变化；不要改写章节正文。
6. data 必须是可 merge 的对象；foreshadow_registry 用 {"items": [...]}。
7. 不要重复已有 foreshadow_registry.items 中已存在的线索。`;

export function buildStorySyncMessages(input: StorySyncPromptInput): GenerationMessage[] {
  const ctx = (input.context ?? {}) as Record<string, unknown>;
  const userPayload = {
    task: 'derive story sync patches from chapter candidate',
    output: 'JSON only',
    runId: input.runId,
    chapterId: input.chapterId,
    candidate: input.candidate,
    context: {
      chapterId: ctx.chapterId,
      chapterNumber: ctx.chapterNumber,
      novelTitle: ctx.novelTitle,
      creativeBrief: ctx.creativeBrief,
      worldSetting: ctx.worldSetting,
      assetCards: ctx.assetCards,
      relationshipGraph: ctx.relationshipGraph,
      foreshadowRegistry: ctx.foreshadowRegistry,
      episodeOutlines: ctx.episodeOutlines,
      growthCurve: ctx.growthCurve,
      pacingCurve: ctx.pacingCurve,
      emotionCurve: ctx.emotionCurve,
    },
  };

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload, null, 2) },
  ];
}
