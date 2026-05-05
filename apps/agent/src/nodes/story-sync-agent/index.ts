import type { CreativeFieldKey, FieldPatchEntry } from '@orison/shared-contracts';
import type { OrchestrationNode } from '../base';
import type { NodeRunInput, NodeRunResult } from '../../contracts/run';
import { env } from '../../common/env';
import { generateText, LlmClientError } from '../../engine/llmClient';
import { deriveStorySyncByRules } from './rules';
import { buildStorySyncMessages } from './prompt';
import { parseStorySyncResponse } from './parser';

/**
 * Story Sync Agent
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
 * 模式：
 *  - rules（默认）: 启发式规则，零依赖、可回归。
 *  - llm: 调用 server `POST /v1/generation/:provider/text`；
 *    若 LLM 调用、JSON 解析、schema 校验或 fieldVersion 校验失败，自动回退 rules。
 *
 * 安全约束（所有模式共享）：
 *  - patches.action 永远是 merge
 *  - patches.field 必须在 creativeFieldKeys 白名单
 *  - patches.fieldVersion 必须匹配上下文当前 version
 *  - patches.generatedBy 强制为 'story-sync-agent'
 */
export type StorySyncDeps = {
  generateText?: typeof generateText;
};

export function createStorySyncNode(deps: StorySyncDeps = {}): OrchestrationNode {
  const callLlm = deps.generateText ?? generateText;

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
      const existingForeshadow = (ctx?.foreshadowRegistry?.items ?? []) as Array<Record<string, any>>;
      const foreshadowVersion =
        typeof ctx?.foreshadowRegistry?.version === 'number'
          ? (ctx.foreshadowRegistry.version as number)
          : 0;

      const fieldVersions = collectFieldVersions(ctx);

      // ── LLM 主路径 ──
      if (env.ORISON_STORY_SYNC_MODE === 'llm' && env.ORISON_LLM_SERVER_URL) {
        const llmResult = await tryLlm(callLlm, {
          runId,
          chapterId,
          candidate,
          ctx,
          fieldVersions,
        });
        if (llmResult) {
          return {
            stateKey: 'story.sync',
            artifact: {
              runId,
              chapterId,
              patches: llmResult.patches,
              summary:
                llmResult.summary ||
                `llm derived ${llmResult.patches.length} field patch(es) from chapter ${chapterId || '(unknown)'}`,
            },
          };
        }
        // LLM 失败 → fallback rules
      }

      // ── 规则 fallback ──
      const { patches } = deriveStorySyncByRules({
        chapterId,
        content,
        chapterNumber: ctx?.chapterNumber,
        existingForeshadow,
        foreshadowVersion,
      });

      const summary =
        patches.length === 0
          ? 'no field updates derived from chapter candidate'
          : `derived ${patches.length} field patch(es) from chapter ${chapterId || '(unknown)'}`;

      return {
        stateKey: 'story.sync',
        artifact: { runId, chapterId, patches, summary },
      };
    },
  };
}

function collectFieldVersions(ctx: Record<string, any> | undefined): Partial<Record<CreativeFieldKey, number>> {
  const v: Partial<Record<CreativeFieldKey, number>> = {};
  if (!ctx) return v;
  const pick = (key: CreativeFieldKey, source: any) => {
    if (typeof source?.version === 'number') v[key] = source.version;
  };
  pick('foreshadow_registry', ctx.foreshadowRegistry);
  pick('relationship_graph', ctx.relationshipGraph);
  pick('asset_cards', ctx.assetCards);
  pick('world_setting', ctx.worldSetting);
  pick('outline', ctx.outline);
  pick('episode_outlines', ctx.episodeOutlines);
  pick('growth_curve', ctx.growthCurve);
  pick('pacing_curve', ctx.pacingCurve);
  pick('emotion_curve', ctx.emotionCurve);
  pick('creative_brief', ctx.creativeBrief);
  return v;
}

type LlmAttemptInput = {
  runId: string;
  chapterId: string;
  candidate: Record<string, any>;
  ctx: Record<string, any> | undefined;
  fieldVersions: Partial<Record<CreativeFieldKey, number>>;
};

type LlmAttemptResult = {
  patches: FieldPatchEntry[];
  summary: string;
};

async function tryLlm(
  callLlm: typeof generateText,
  input: LlmAttemptInput,
): Promise<LlmAttemptResult | null> {
  if (!env.ORISON_LLM_SERVER_URL) return null;
  const messages = buildStorySyncMessages({
    runId: input.runId,
    chapterId: input.chapterId,
    candidate: input.candidate,
    context: input.ctx ?? {},
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ORISON_STORY_SYNC_LLM_TIMEOUT_MS);

  try {
    const response = await callLlm({
      serverUrl: env.ORISON_LLM_SERVER_URL,
      provider: env.ORISON_LLM_PROVIDER,
      model: env.ORISON_LLM_MODEL,
      apiKey: env.ORISON_LLM_API_KEY,
      baseUrl: env.ORISON_LLM_BASE_URL,
      messages,
      temperature: 0.2,
      signal: controller.signal,
    });

    const parsed = parseStorySyncResponse(response.text, {
      runId: input.runId,
      chapterId: input.chapterId,
      fieldVersions: input.fieldVersions,
    });
    if (!parsed.ok) return null;
    return { patches: parsed.payload.patches, summary: parsed.payload.summary };
  } catch (error) {
    if (error instanceof LlmClientError) return null;
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
