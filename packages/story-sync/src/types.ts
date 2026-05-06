import type { CreativeFieldKey, FieldPatchEntry, NovelStorySyncPayload } from '@orison/shared-contracts';

export type StorySyncPatch = FieldPatchEntry;
export type StorySyncResult = NovelStorySyncPayload;

/**
 * Per-field current versions taken from the orchestration context. Patches
 * whose `fieldVersion` does not match the recorded version for that field
 * are dropped before the patch is applied.
 */
export type FieldVersionMap = Partial<Record<CreativeFieldKey, number>>;

/**
 * Forced caller-side context. Whatever the LLM (or the desktop bridge) emits
 * for `runId` / `chapterId` / `generatedBy`, the safety layer overrides those
 * with the values the caller pinned.
 */
export type SafetyContext = {
  runId: string;
  chapterId: string;
  fieldVersions: FieldVersionMap;
};

export type SafetyWarning = {
  reason: string;
  patch?: unknown;
};

export type EnforceSafetyResult = {
  patches: StorySyncPatch[];
  warnings: SafetyWarning[];
};

export type ParseStorySyncResult =
  | { ok: true; payload: StorySyncResult }
  | { ok: false; reason: string };
