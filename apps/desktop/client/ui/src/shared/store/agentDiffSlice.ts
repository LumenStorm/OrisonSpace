import type { StateCreator } from 'zustand';
import type { ChapterAccessor } from './types';
import type { SelectionAnchor } from '../types/attachment';
import { resolveAgentConfirmation } from '../api/agent';

/** Whole-chapter rewrite (existing behaviour). Applied by replacing chapter content wholesale. */
export type ChapterPendingDiff = {
  kind: 'chapter';
  id: string;
  toolId: string;
  fileName: string;
  content: string;
  chapterId?: string;
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
export const WRITE_TOOLS = ['chapter_write', 'write_file', 'outline_update', 'rewrite_passage'];

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

type Deps = AgentDiffSlice & ChapterAccessor & {
  agentSessionId: string | null;
  agentLoading: boolean;
  saveChaptersToProject: () => Promise<void>;
  openFiles: { path: string; content: string }[];
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<boolean>;
};

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

export const createAgentDiffSlice: StateCreator<Deps, [], [], AgentDiffSlice> = (set, get) => ({
  pendingDiffs: [],
  pendingToolConfirm: null,
  pendingPassageResolve: null,

  acceptDiff(id) {
    const state = get();
    const diff = state.pendingDiffs.find((d) => d.id === id);
    if (!diff) return;

    if (diff.kind === 'chapter') {
      const chapter = state.chapters.find((c) =>
        diff.chapterId ? c.id === diff.chapterId : c.title.includes(diff.fileName.replace('.md', '')),
      );
      if (chapter) {
        state.updateChapter(chapter.id, { content: diff.content });
        void state.saveChaptersToProject();
      }
      set({ pendingDiffs: state.pendingDiffs.filter((d) => d.id !== id) });
      return;
    }

    // passage: relocate in the latest content at accept time
    const current = diff.sourceType === 'chapter'
      ? state.chapters.find((c) => c.id === diff.chapterId)?.content
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
      ? state.chapters.find((c) => c.id === resolve.chapterId)?.content
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
});

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
    state.updateChapter(chapterId, { content: next });
    void state.saveChaptersToProject();
  } else if (sourceType === 'file' && filePath) {
    state.updateFileContent(filePath, next);
    void state.saveFile(filePath);
  }
}

