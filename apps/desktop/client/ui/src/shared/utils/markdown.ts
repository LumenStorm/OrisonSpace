import { marked } from 'marked';
import TurndownService from 'turndown';

marked.setOptions({
  gfm: true,
  breaks: false,
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

turndown.addRule('strikethrough', {
  filter: ['s', 'del'] as Array<keyof HTMLElementTagNameMap>,
  replacement: (content) => `~~${content}~~`,
});

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  return (marked.parse(markdown, { async: false }) as string).trimEnd();
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndown
    .turndown(html)
    .replace(/^([*+-]) {2,}/gm, '$1 ')
    .replace(/^(\d+\.) {2,}/gm, '$1 ')
    .trim();
}

// ── Round-trip loss detection ──────────────────────────────────────────────
// The TipTap editor only registers StarterKit (no table/image/html nodes). A
// markdown→HTML→TipTap→markdown round-trip silently drops any construct the
// schema doesn't know, so an unsuspecting edit + autosave permanently deletes
// tables, images, HTML blocks and front-matter. We detect those specific
// high-value constructs and, when they wouldn't survive, fall back to a raw
// source editor rather than corrupting the manuscript. We count constructs
// before/after (rather than full-string equality) because marked+turndown
// reformats even lossless content (list markers, emphasis tokens, blank lines).

const IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/g;
// A GFM table delimiter row (`---|---`, `| :-- | --: |`). It must contain a
// pipe — a bare `---` line is a horizontal rule / setext underline, which
// writers use as scene breaks and which the round-trip preserves (as `* * *`).
const TABLE_DELIM_RE = /^(?=[^\n]*\|)[\s:|-]*-[\s:|-]*$/gm;
// Raw block/inline HTML tags StarterKit won't round-trip (turndown keeps <a>,
// <strong>, <em>, <code> etc. via its rules, so scope to structural/table/media
// tags that get dropped).
const RAW_HTML_RE = /<\/?(?:table|thead|tbody|tr|td|th|div|span|section|article|figure|figcaption|img|iframe|video|audio|details|summary|mark|sub|sup|kbd)\b[^>]*>/gi;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/** Leading `--- ... ---` YAML front-matter block (dropped by marked). */
function hasFrontMatter(md: string): boolean {
  return /^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(md);
}

/** Remove fenced blocks and inline code, where markdown syntax is literal text. */
function stripCodeSpans(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');
}

/**
 * True when opening `md` in the TipTap editor would lose content on the next
 * save. Callers should fall back to a raw source editor when this returns true.
 */
export function isMarkdownRoundTripLossy(md: string): boolean {
  if (!md) return false;
  // Front-matter never survives; short-circuit.
  if (hasFrontMatter(md)) return true;
  // Images: the proxy round-trip below preserves them (turndown ships an <img>
  // rule), but the real editor schema has no image node and drops them — so
  // presence outside code spans is already lossy.
  if (countMatches(stripCodeSpans(md), IMAGE_RE) > 0) return true;

  const roundTripped = htmlToMarkdown(markdownToHtml(md));

  // Any structural HTML in the source that the round-trip strips out.
  if (countMatches(md, RAW_HTML_RE) > countMatches(roundTripped, RAW_HTML_RE)) return true;
  // GFM tables dropped (no table node) — compare delimiter-row counts.
  if (countMatches(md, TABLE_DELIM_RE) > countMatches(roundTripped, TABLE_DELIM_RE)) return true;

  return false;
}

