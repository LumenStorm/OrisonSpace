import { creativeFieldKeys, type FieldPatchEntry } from '@orison/shared-contracts';
import type {
  EnforceSafetyResult,
  SafetyContext,
  SafetyWarning,
  StorySyncPatch,
} from './types';

const CREATIVE_FIELD_SET = new Set<string>(creativeFieldKeys);

/**
 * Enforce the story-sync safety contract on a list of LLM-emitted (or
 * desktop-precomputed) patches.
 *
 * Rules — shared by every caller (desktop main, agent fallback validator):
 *  - `field` must be in `creativeFieldKeys` whitelist.
 *  - `action` must be `'merge'`. Anything else is dropped (never thrown).
 *  - `fieldVersion` must equal the recorded current version for that field
 *    (when one is recorded). Stale patches are dropped.
 *  - `generatedBy` is forced to `'story-sync-agent'` regardless of input —
 *    the LLM cannot impersonate another node.
 *  - `runId` / `chapterId` are forced to the caller-supplied values; the LLM
 *    never gets to swap them.
 *
 * Returns the safe subset plus a structured warning list. Never throws.
 */
export function enforcePatchSafety(
  patches: unknown[],
  ctx: SafetyContext,
): EnforceSafetyResult {
  const safe: StorySyncPatch[] = [];
  const warnings: SafetyWarning[] = [];

  for (const raw of patches) {
    if (!raw || typeof raw !== 'object') {
      warnings.push({ reason: 'patch is not an object', patch: raw });
      continue;
    }
    const patch = raw as Partial<FieldPatchEntry> & Record<string, unknown>;

    if (typeof patch.field !== 'string' || !CREATIVE_FIELD_SET.has(patch.field)) {
      warnings.push({ reason: `field '${String(patch.field)}' is not a creative field`, patch });
      continue;
    }
    if (patch.action !== 'merge') {
      warnings.push({ reason: `action '${String(patch.action)}' is not 'merge'`, patch });
      continue;
    }
    if (typeof patch.fieldVersion !== 'number' || !Number.isFinite(patch.fieldVersion)) {
      warnings.push({ reason: 'fieldVersion is not a finite number', patch });
      continue;
    }

    const expectedVersion = ctx.fieldVersions[patch.field as keyof typeof ctx.fieldVersions];
    if (typeof expectedVersion === 'number' && patch.fieldVersion !== expectedVersion) {
      warnings.push({
        reason: `fieldVersion ${patch.fieldVersion} does not match expected ${expectedVersion} for field ${patch.field}`,
        patch,
      });
      continue;
    }

    if (!patch.data || typeof patch.data !== 'object') {
      warnings.push({ reason: 'patch.data is not an object', patch });
      continue;
    }

    safe.push({
      field: patch.field as FieldPatchEntry['field'],
      action: 'merge',
      data: patch.data as Record<string, unknown>,
      fieldVersion: patch.fieldVersion,
      generatedBy: 'story-sync-agent',
    });
  }

  return { patches: safe, warnings };
}
