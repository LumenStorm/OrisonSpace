import type { SelectionAnchor } from '../types/attachment';

type SelectionReference = {
  type: 'selection';
  text?: string;
  chapterId?: string;
  filePath?: string;
  anchor?: SelectionAnchor;
};

export type PassageAnchorMessage = {
  references?: unknown;
};

function isSelectionReference(value: unknown): value is SelectionReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'selection' &&
    typeof (value as { anchor?: unknown }).anchor === 'object' &&
    (value as { anchor?: unknown }).anchor !== null
  );
}

function comparableText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\s+/g, '')
    .trim();
}

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

function isLikelySamePassage(a: string | undefined, b: string): boolean {
  if (!a) return false;
  if (a === b || a.trim() === b.trim()) return true;

  const ca = comparableText(a);
  const cb = comparableText(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;

  const shorter = ca.length <= cb.length ? ca : cb;
  const longer = ca.length > cb.length ? ca : cb;
  if (shorter.length >= 40 && longer.includes(shorter) && shorter.length / longer.length >= 0.75) {
    return true;
  }
  return shorter.length >= 80 && diceSimilarity(ca, cb) >= 0.9;
}

export function recoverSelectionAnchorFromMessages(
  messages: PassageAnchorMessage[],
  originalText: string,
  chapterId: string | undefined,
  filePath: string | undefined,
): SelectionAnchor | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const refs = messages[i].references;
    if (!Array.isArray(refs)) continue;
    for (const ref of refs) {
      if (!isSelectionReference(ref)) continue;
      const sameSource = chapterId ? ref.chapterId === chapterId : filePath ? ref.filePath === filePath : true;
      if (!sameSource) continue;
      if (
        isLikelySamePassage(ref.anchor?.quote, originalText) ||
        isLikelySamePassage(ref.text, originalText)
      ) {
        return ref.anchor;
      }
    }
  }
  return undefined;
}
