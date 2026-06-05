/**
 * Shared attachment + selection contract types for the "选段 → AI 评阅 → 回写"
 * feature. These are the canonical shapes consumed by the agent panel, editor
 * right-click entry points, the session store, and the passage diff pipeline.
 *
 * Keep this in sync with the agent-side `MessageAttachment` / `MessageSelectionAnchor`
 * (apps/desktop/agent/src/runtime/workflow.ts) — the UI sends `Attachment[]` over
 * IPC and the runtime renders them into structured reference blocks.
 */

/**
 * Locates a selected passage so it can be re-found in the latest manuscript text
 * even after edits drift the original offsets.
 * - `quote`: the exact selected text (primary relocation key)
 * - `prefix` / `suffix`: surrounding context used to disambiguate duplicate quotes
 * - `rangeHint`: character offsets at capture time (best-effort, may be stale)
 */
export interface SelectionAnchor {
  quote: string;
  prefix: string;
  suffix: string;
  rangeHint: { from: number; to: number };
}

/**
 * A passage selected in the editor, carried as a structured attachment with its
 * provenance (chapter or file) and anchor.
 */
export interface SelectionAttachment {
  type: 'selection';
  id: string;
  label: string;
  text: string;
  sourceType: 'chapter' | 'file';
  chapterId?: string;
  filePath?: string;
  anchor: SelectionAnchor;
}

/** Lightweight pointer to a whole chapter. */
export interface ChapterAttachment {
  type: 'chapter';
  id: string;
  label: string;
}

/** Lightweight pointer to a whole open file. */
export interface FileAttachment {
  type: 'file';
  id: string;
  label: string;
}

/** Any attachment that can be pinned to a message. */
export type Attachment = ChapterAttachment | FileAttachment | SelectionAttachment;
