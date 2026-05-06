import { creativeFieldKeys, novelStorySyncPayloadSchema } from '@orison/shared-contracts';
import { enforcePatchSafety } from './safety';
import type { ParseStorySyncResult, SafetyContext } from './types';

const CREATIVE_SET = new Set<string>(creativeFieldKeys);

/**
 * Extract a JSON block from an LLM-style text response.
 *
 * Tolerates:
 *  - Pure JSON (the whole text is the object).
 *  - Fenced JSON (```json ... ``` or ``` ... ```).
 *  - JSON nested inside surrounding prose (uses the first '{' to the last '}').
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

/**
 * Parse an LLM text response into a `NovelStorySyncPayload`. Schema-validate
 * the envelope, then enforce the patch safety contract.
 *
 * Strict policy:
 *  - Must extract a JSON block.
 *  - Envelope (`runId` / `chapterId` / `patches[]` / `summary`) must
 *    schema-parse. `runId` and `chapterId` are forced from `options`.
 *  - Each patch passes through `enforcePatchSafety` (whitelist field, action
 *    must be `merge`, fieldVersion must match recorded context, etc.).
 *  - Whitelist violation on any patch -> ok=false (the LLM invented an
 *    unsafe field; we reject the whole response).
 *  - Stale fieldVersion or non-merge action -> dropped, but ok=true.
 */
export function parseStorySyncResponse(
  text: string,
  options: SafetyContext,
): ParseStorySyncResult {
  const json = extractJsonBlock(text);
  if (!json) return { ok: false, reason: 'no JSON block in LLM response' };

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return { ok: false, reason: `JSON parse failed: ${(error as Error).message}` };
  }

  const summary =
    typeof (raw as Record<string, unknown>)?.summary === 'string'
      && ((raw as Record<string, unknown>).summary as string).length > 0
      ? ((raw as Record<string, unknown>).summary as string)
      : 'llm story-sync output';
  const candidatePatches = Array.isArray((raw as Record<string, unknown>)?.patches)
    ? ((raw as Record<string, unknown>).patches as unknown[])
    : [];

  if (candidatePatches.length > 0) {
    const allWhitelisted = candidatePatches.every((p) => {
      if (!p || typeof p !== 'object') return false;
      const field = (p as { field?: unknown }).field;
      return typeof field === 'string' && CREATIVE_SET.has(field);
    });
    if (!allWhitelisted) {
      return { ok: false, reason: 'patch field not in creative-field whitelist' };
    }
  }

  const parsed = novelStorySyncPayloadSchema.safeParse({
    runId: options.runId,
    chapterId: options.chapterId,
    summary,
    patches: candidatePatches,
  });
  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message}` };
  }

  const safety = enforcePatchSafety(parsed.data.patches, options);

  return {
    ok: true,
    payload: {
      runId: options.runId,
      chapterId: options.chapterId,
      summary: parsed.data.summary,
      patches: safety.patches,
    },
  };
}

/**
 * Validate a list of pre-computed patches (from desktop) on the agent side.
 *
 * Used by `apps/agent/src/nodes/story-sync-agent/index.ts` to revalidate the
 * `artifacts['chapter.llmPatches']` body before applying it. Treats the input
 * as untrusted: agent never blindly applies what the run body claims.
 *
 * Returns `ok=false` only on hard violations (input shape, whitelist).
 * Stale-version and non-merge patches are dropped silently with `ok=true`.
 */
export function parseStorySyncPatches(
  rawPatches: unknown,
  options: SafetyContext,
): ParseStorySyncResult {
  if (!Array.isArray(rawPatches)) {
    return { ok: false, reason: 'patches is not an array' };
  }

  for (const item of rawPatches) {
    if (!item || typeof item !== 'object') {
      return { ok: false, reason: 'patch is not an object' };
    }
    const field = (item as { field?: unknown }).field;
    if (typeof field !== 'string' || !CREATIVE_SET.has(field)) {
      return { ok: false, reason: `field '${String(field)}' not in creative-field whitelist` };
    }
  }

  const safety = enforcePatchSafety(rawPatches, options);

  return {
    ok: true,
    payload: {
      runId: options.runId,
      chapterId: options.chapterId,
      summary: `pre-computed patches (${safety.patches.length} kept, ${safety.warnings.length} rejected)`,
      patches: safety.patches,
    },
  };
}
