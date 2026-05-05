import {
  creativeFieldKeys,
  novelStorySyncPayloadSchema,
  type CreativeFieldKey,
  type FieldPatchEntry,
  type NovelStorySyncPayload,
} from '@orison/shared-contracts';

const CREATIVE_FIELD_SET = new Set<string>(creativeFieldKeys);

/**
 * 从 LLM 文本响应中提取 JSON 字符串。
 * 支持以下情况：
 *  - 整段就是 JSON
 *  - 用 ``` / ```json 包裹
 *  - 含前后噪声，但有 {…} 块
 */
function extractJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) return trimmed;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

export type ParseStorySyncOptions = {
  runId: string;
  chapterId: string;
  /** 上下文中各创作字段的当前 version，用于校验/过滤越界 patch */
  fieldVersions: Partial<Record<CreativeFieldKey, number>>;
};

export type ParseStorySyncResult =
  | { ok: true; payload: NovelStorySyncPayload }
  | { ok: false; reason: string };

/**
 * 解析 LLM 文本响应为合法的 NovelStorySyncPayload。
 *
 * 严格策略：
 *  - 必须能提取 JSON 并通过 zod 校验
 *  - patches 中 field 必须在 creativeFieldKeys 白名单
 *  - action 强制 merge（其余直接丢弃，不抛错）
 *  - fieldVersion 必须匹配上下文中对应字段的当前 version；不匹配则丢弃该 patch
 *  - generatedBy 强制写为 'story-sync-agent'
 *  - runId / chapterId 强制使用调用方给定值，避免被 LLM 替换
 */
export function parseStorySyncResponse(
  text: string,
  options: ParseStorySyncOptions,
): ParseStorySyncResult {
  const json = extractJsonBlock(text);
  if (!json) return { ok: false, reason: 'no JSON block in LLM response' };

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return { ok: false, reason: `JSON parse failed: ${(error as Error).message}` };
  }

  const parsed = novelStorySyncPayloadSchema.safeParse({
    runId: options.runId,
    chapterId: options.chapterId,
    summary: typeof (raw as any)?.summary === 'string' && (raw as any).summary.length > 0
      ? (raw as any).summary
      : 'llm story-sync output',
    patches: Array.isArray((raw as any)?.patches) ? (raw as any).patches : [],
  });

  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message}` };
  }

  const safePatches: FieldPatchEntry[] = [];
  for (const patch of parsed.data.patches) {
    if (!CREATIVE_FIELD_SET.has(patch.field)) continue;
    if (patch.action !== 'merge') continue;
    const expectedVersion = options.fieldVersions[patch.field];
    if (typeof expectedVersion === 'number' && patch.fieldVersion !== expectedVersion) {
      continue;
    }
    safePatches.push({
      ...patch,
      generatedBy: 'story-sync-agent',
    });
  }

  return {
    ok: true,
    payload: {
      ...parsed.data,
      patches: safePatches,
    },
  };
}
