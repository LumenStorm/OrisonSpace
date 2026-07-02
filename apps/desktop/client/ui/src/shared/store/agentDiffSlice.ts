import type { StateCreator } from 'zustand';
import type { SelectionAnchor } from '../types/attachment';
import { resolveAgentConfirmation } from '../api/agent';
import { registerProjectReset } from './resetRegistry';
import { normalizePath } from '../utils/paths';

/** Whole-chapter rewrite (existing behaviour). Applied by replacing chapter content wholesale. */
export type ChapterPendingDiff = {
  kind: 'chapter';
  id: string;
  toolId: string;
  /** Unique per tool call — used to match the DiffCard to its own diff. */
  toolCallId?: string;
  fileName: string;
  content: string;
  chapterId?: string;
  /**
   * suggest-mode reject support: the tool already wrote to disk at execution
   * time, so reject must undo that write. `previousContent` is the on-disk text
   * before the write (null when the file was newly created → reject deletes it);
   * `filePath` is the absolute path actually written (set for write_file, whose
   * target isn't under chapters/).
   */
  previousContent?: string | null;
  existedBefore?: boolean;
  filePath?: string;
};

/**
 * Passage-level rewrite. The replacement is NOT applied until accept time, when
 * `originalText` is relocated in the *latest* manuscript text via `anchor`.
 */
export type PassagePendingDiff = {
  kind: 'passage';
  id: string;
  toolId: string;
  sourceType: 'chapter' | 'file';
  chapterId?: string;
  filePath?: string;
  originalText: string;
  replacement: string;
  anchor?: SelectionAnchor;
};

export type PendingDiff = ChapterPendingDiff | PassagePendingDiff;

/**
 * Tools whose result produces an editable diff instead of a plain tool card.
 * `rewrite_passage` carries passage-level metadata; the others carry whole-chapter
 * `content`. Single source of truth — consumed by both the session slice (which
 * builds the pending diff) and AgentMessageItem (which routes the render).
 */
export const WRITE_TOOLS = ['chapter_write', 'write_file', 'outline_update', 'overview_update', 'rewrite_passage'];

/** A possible target location for an unresolved passage rewrite. */
export type PassageCandidate = {
  from: number;
  to: number;
  /** Text surrounding the candidate, for UI highlight/preview. */
  excerpt: string;
};

/**
 * Set when an accepted passage diff could not be applied automatically — either
 * the original text was not found (drifted/edited) or it matched multiple spots.
 * The UI (Phase 2) renders candidate highlights and calls `resolvePassageAt`.
 */
export type PendingPassageResolve = {
  diffId: string;
  sourceType: 'chapter' | 'file';
  chapterId?: string;
  filePath?: string;
  originalText: string;
  replacement: string;
  reason: 'not-found' | 'ambiguous';
  candidates: PassageCandidate[];
};

export type AgentDiffSlice = {
  pendingDiffs: PendingDiff[];
  acceptDiff: (id: string) => void;
  rejectDiff: (id: string) => void;

  pendingPassageResolve: PendingPassageResolve | null;
  resolvePassageAt: (diffId: string, chosenIndex: number) => void;
  cancelPassageResolve: () => void;

  pendingToolConfirm: { callId: string; name: string; input: unknown } | null;
  confirmPendingTool: () => void;
  rejectPendingTool: () => void;
};

type Deps = AgentDiffSlice & {
  agentSessionId: string | null;
  agentLoading: boolean;
  openFiles: { path: string; content: string }[];
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<boolean>;
  openFile: (path: string, name: string, content: string, options?: { kind?: 'text' | 'image' | 'docx' }) => void;
  closeFilesUnder?: (pathOrDir: string) => void;
  currentProject: { path?: string } | null;
  novelChapters: { id: string; sections: { contentFile: string }[] }[];
  refreshWordCount?: () => Promise<void>;
};

/**
 * Resolve the on-disk manuscript file for a chapter. The canonical layout is
 * `chapters/<chapterId>.md` (see chapterWriteHandler); when the project document
 * records an explicit `contentFile` for the chapter we honour that instead.
 * Returns an absolute, normalized path, or null if it can't be resolved.
 */
function resolveChapterFilePath(state: Deps, chapterId: string | undefined, fileName: string | undefined): string | null {
  const projectPath = state.currentProject?.path;
  if (!projectPath) return null;

  if (chapterId) {
    const meta = state.novelChapters.find((c) => c.id === chapterId);
    const contentFile = meta?.sections?.[0]?.contentFile;
    if (contentFile) return normalizePath(`${projectPath}/${contentFile}`);
    return normalizePath(`${projectPath}/chapters/${chapterId}.md`);
  }
  if (fileName) {
    // fileName is a bare manuscript name like "chapter-01.md".
    return normalizePath(`${projectPath}/chapters/${fileName}`);
  }
  return null;
}

/**
 * Read a chapter's latest content from its open tab, if any. Passage relocation
 * needs the current in-editor text; when the chapter file isn't open there is no
 * in-memory copy to relocate against (returns undefined → caller drops the diff).
 */
function readChapterContent(state: Deps, chapterId: string | undefined): string | undefined {
  const filePath = resolveChapterFilePath(state, chapterId, undefined);
  if (!filePath) return undefined;
  return state.openFiles.find((f) => f.path === filePath)?.content;
}

/**
 * Persist whole-chapter content to its `.md` file (the manuscript source of
 * truth). If the file is already open as a tab, route through the tab so the
 * editor view stays in sync; otherwise write straight to disk.
 */
function persistChapterContent(state: Deps, filePath: string, content: string): void {
  const openTab = state.openFiles.find((f) => f.path === filePath);
  if (openTab) {
    state.updateFileContent(filePath, content);
    void state.saveFile(filePath);
    return;
  }
  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
  // Open the tab with the new content and save it — this both persists to disk
  // and surfaces the change to the user (matching how an open file would behave).
  state.openFile(filePath, fileName, content, { kind: 'text' });
  void state.saveFile(filePath);
  void state.refreshWordCount?.();
}

// ── passage relocation helpers ──

function findAllOccurrences(haystack: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    out.push(idx);
    from = idx + 1;
  }
  return out;
}

function makeExcerpt(content: string, from: number, to: number, pad = 24): string {
  const start = Math.max(0, from - pad);
  const end = Math.min(content.length, to + pad);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return `${prefix}${content.slice(start, end)}${suffix}`;
}

/** Dice coefficient on character bigrams — cheap fuzzy similarity for fallback candidates. */
function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let overlap = 0;
  for (const [g, count] of ba) {
    const other = bb.get(g);
    if (other) overlap += Math.min(count, other);
  }
  const total = (a.length - 1) + (b.length - 1);
  return total > 0 ? (2 * overlap) / total : 0;
}

type LocateResult =
  | { status: 'unique'; from: number; to: number }
  | { status: 'ambiguous'; candidates: PassageCandidate[] }
  | { status: 'not-found'; candidates: PassageCandidate[] };

/** Score an occurrence by anchor context (prefix/suffix) and proximity to rangeHint. */
function scoreOccurrence(content: string, idx: number, len: number, anchor?: SelectionAnchor): number {
  if (!anchor) return 0;
  let score = 0;
  if (anchor.prefix) {
    const before = content.slice(Math.max(0, idx - anchor.prefix.length), idx);
    if (before.endsWith(anchor.prefix)) score += 2;
    else score += diceSimilarity(before, anchor.prefix);
  }
  if (anchor.suffix) {
    const after = content.slice(idx + len, idx + len + anchor.suffix.length);
    if (after.startsWith(anchor.suffix)) score += 2;
    else score += diceSimilarity(after, anchor.suffix);
  }
  // Closer to the captured offset is better (small tie-breaker in [0,1)).
  const drift = Math.abs(idx - anchor.rangeHint.from);
  score += 1 / (1 + drift / 100);
  return score;
}

/**
 * Relocate a passage in the latest content.
 * - exactly one exact match → unique
 * - several exact matches → disambiguate via anchor; a clear winner returns unique,
 *   otherwise ambiguous with all occurrences as candidates
 * - no exact match → not-found with best-effort fuzzy paragraph candidates
 */
function locatePassage(content: string, originalText: string, anchor?: SelectionAnchor): LocateResult {
  const occurrences = findAllOccurrences(content, originalText);
  const len = originalText.length;

  if (occurrences.length === 1) {
    return { status: 'unique', from: occurrences[0], to: occurrences[0] + len };
  }

  if (occurrences.length > 1) {
    const scored = occurrences
      .map((idx) => ({ idx, score: scoreOccurrence(content, idx, len, anchor) }))
      .sort((a, b) => b.score - a.score);
    const [best, second] = scored;
    // Clear winner only if an anchor produced a meaningfully higher score.
    if (anchor && best.score - second.score >= 1) {
      return { status: 'unique', from: best.idx, to: best.idx + len };
    }
    return {
      status: 'ambiguous',
      candidates: occurrences.map((idx) => ({ from: idx, to: idx + len, excerpt: makeExcerpt(content, idx, idx + len) })),
    };
  }

  // No exact match — offer fuzzy paragraph candidates so the UI can highlight.
  const paragraphs: PassageCandidate[] = [];
  const re = /\n{2,}|\n/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  const pushPara = (from: number, to: number) => {
    const text = content.slice(from, to);
    if (text.trim().length > 0) paragraphs.push({ from, to, excerpt: text });
  };
  while ((m = re.exec(content)) !== null) {
    pushPara(cursor, m.index);
    cursor = m.index + m[0].length;
  }
  pushPara(cursor, content.length);

  const ranked = paragraphs
    .map((c) => ({ c, score: diceSimilarity(c.excerpt, originalText) }))
    .sort((a, b) => b.score - a.score)
    .filter((x) => x.score > 0.2)
    .slice(0, 3)
    .map((x) => ({ ...x.c, excerpt: makeExcerpt(content, x.c.from, x.c.to, 0) }));

  return { status: 'not-found', candidates: ranked };
}

export const createAgentDiffSlice: StateCreator<Deps, [], [], AgentDiffSlice> = (set, get) => {
  // Pending diffs/passage-resolve/tool-confirm reference the previous project's
  // chapters and files. resetAgentForProjectSwitch already clears the session,
  // but diffs live in this slice — clear them here so accepting a stale diff
  // after a switch can't write into the new project.
  registerProjectReset(() => {
    set({ pendingDiffs: [], pendingPassageResolve: null, pendingToolConfirm: null });
  });

  return {
  pendingDiffs: [],
  pendingToolConfirm: null,
  pendingPassageResolve: null,

  acceptDiff(id) {
    const state = get();
    const diff = state.pendingDiffs.find((d) => d.id === id);
    if (!diff) return;

    if (diff.kind === 'chapter') {
      // Persist to the manuscript .md file (the source of truth). If the file is
      // open as a tab the write routes through it so the editor view stays in
      // sync; otherwise it goes straight to disk.
      const filePath = resolveChapterFilePath(state, diff.chapterId, diff.fileName);
      if (filePath) {
        persistChapterContent(state, filePath, diff.content);
      }
      set({ pendingDiffs: state.pendingDiffs.filter((d) => d.id !== id) });
      return;
    }

    // passage: relocate in the latest content at accept time
    const current = diff.sourceType === 'chapter'
      ? readChapterContent(state, diff.chapterId)
      : state.openFiles.find((f) => f.path === diff.filePath)?.content;

    if (current == null) {
      // Source no longer open/available — drop the stale diff.
      set({ pendingDiffs: state.pendingDiffs.filter((d) => d.id !== id) });
      return;
    }

    const located = locatePassage(current, diff.originalText, diff.anchor);
    if (located.status === 'unique') {
      applyPassage(state, diff.sourceType, diff.chapterId, diff.filePath, current, located.from, located.to, diff.replacement);
      set({ pendingDiffs: state.pendingDiffs.filter((d) => d.id !== id) });
      return;
    }

    // 0 or ambiguous matches → hand off to UI candidate-confirm flow; keep the diff.
    set({
      pendingPassageResolve: {
        diffId: diff.id,
        sourceType: diff.sourceType,
        chapterId: diff.chapterId,
        filePath: diff.filePath,
        originalText: diff.originalText,
        replacement: diff.replacement,
        reason: located.status === 'ambiguous' ? 'ambiguous' : 'not-found',
        candidates: located.candidates,
      },
    });
  },

  resolvePassageAt(diffId, chosenIndex) {
    const state = get();
    const resolve = state.pendingPassageResolve;
    if (!resolve || resolve.diffId !== diffId) return;
    const candidate = resolve.candidates[chosenIndex];
    if (!candidate) return;

    const current = resolve.sourceType === 'chapter'
      ? readChapterContent(state, resolve.chapterId)
      : state.openFiles.find((f) => f.path === resolve.filePath)?.content;
    if (current == null) {
      set({ pendingPassageResolve: null, pendingDiffs: state.pendingDiffs.filter((d) => d.id !== diffId) });
      return;
    }

    applyPassage(state, resolve.sourceType, resolve.chapterId, resolve.filePath, current, candidate.from, candidate.to, resolve.replacement);
    set({
      pendingPassageResolve: null,
      pendingDiffs: state.pendingDiffs.filter((d) => d.id !== diffId),
    });
  },

  cancelPassageResolve() {
    // Keep the pending diff so the user can retry or reject it explicitly.
    set({ pendingPassageResolve: null });
  },

  rejectDiff(id) {
    const state = get();
    const diff = state.pendingDiffs.find((d) => d.id === id);
    // A chapter/file write already hit disk at tool-execution time (suggest
    // mode reviews after the fact). Rejecting must undo that write, otherwise
    // "reject" silently keeps the agent's change.
    if (diff && diff.kind === 'chapter') {
      void restoreRejectedWrite(state, diff);
    }
    set((s) => ({
      pendingDiffs: s.pendingDiffs.filter((d) => d.id !== id),
      pendingPassageResolve: s.pendingPassageResolve?.diffId === id ? null : s.pendingPassageResolve,
    }));
  },

  confirmPendingTool() {
    const pending = get().pendingToolConfirm;
    const sessionId = get().agentSessionId;
    if (!pending || !sessionId) return;
    set({ pendingToolConfirm: null, agentLoading: true });
    void resolveAgentConfirmation(sessionId, pending.callId, true);
  },

  rejectPendingTool() {
    const pending = get().pendingToolConfirm;
    const sessionId = get().agentSessionId;
    if (!pending || !sessionId) return;
    set({ pendingToolConfirm: null, agentLoading: true });
    void resolveAgentConfirmation(sessionId, pending.callId, false);
  },
  };
};

/** Splice replacement into [from,to) of the latest content and persist to the right source. */
function applyPassage(
  state: Deps,
  sourceType: 'chapter' | 'file',
  chapterId: string | undefined,
  filePath: string | undefined,
  current: string,
  from: number,
  to: number,
  replacement: string,
): void {
  const next = current.slice(0, from) + replacement + current.slice(to);
  if (sourceType === 'chapter' && chapterId) {
    // Persist the spliced chapter to its manuscript file (the source of truth).
    const chapterFile = resolveChapterFilePath(state, chapterId, undefined);
    if (chapterFile) persistChapterContent(state, chapterFile, next);
  } else if (sourceType === 'file' && filePath) {
    state.updateFileContent(filePath, next);
    void state.saveFile(filePath);
  }
}

/**
 * Undo an already-written chapter/file diff when the user rejects it in suggest
 * mode (the tool wrote to disk at execution time). Restores the pre-write text,
 * or deletes the file if the write created it. Keeps any open editor tab in sync.
 */
async function restoreRejectedWrite(state: Deps, diff: ChapterPendingDiff): Promise<void> {
  const api = window.orisonDesktop;
  if (!api) return;
  // write_file targets an arbitrary path (diff.filePath); chapter writes resolve
  // to chapters/<id>.md.
  const projectPath = state.currentProject?.path;
  const absPath = diff.filePath && projectPath
    ? normalizePath(`${projectPath}/${diff.filePath}`)
    : resolveChapterFilePath(state, diff.chapterId, diff.fileName);
  if (!absPath) return;

  // No snapshot info → can't safely restore; leave disk as-is.
  if (diff.existedBefore === undefined) return;

  if (!diff.existedBefore) {
    // The write created the file — delete it and close any ghost tab.
    try { await api.deleteEntry?.(absPath); } catch { /* best effort */ }
    state.closeFilesUnder?.(absPath);
    return;
  }

  // The file existed — restore its previous content (in the open tab if any).
  const previous = diff.previousContent ?? '';
  const openTab = state.openFiles.find((f) => f.path === absPath);
  if (openTab) {
    state.updateFileContent(absPath, previous);
    void state.saveFile(absPath);
  } else {
    try { await api.writeFile?.(absPath, previous); } catch { /* best effort */ }
  }
}

