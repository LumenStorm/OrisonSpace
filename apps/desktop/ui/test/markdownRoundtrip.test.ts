import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from '../src/shared/utils/markdown';

function roundtrip(md: string): string {
  return htmlToMarkdown(markdownToHtml(md)).trim();
}

describe('markdown round-trip', () => {
  it('preserves headings', () => {
    const md = '# Title\n\n## Subtitle\n\n### Sub-sub';
    expect(roundtrip(md)).toBe('# Title\n\n## Subtitle\n\n### Sub-sub');
  });

  it('preserves paragraphs', () => {
    const md = 'First paragraph.\n\nSecond paragraph.';
    expect(roundtrip(md)).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('preserves bold and italic', () => {
    const md = 'This is **bold** and *italic* text.';
    expect(roundtrip(md)).toBe('This is **bold** and *italic* text.');
  });

  it('preserves strikethrough', () => {
    const md = '~~deleted~~ text';
    expect(roundtrip(md)).toBe('~~deleted~~ text');
  });

  it('preserves inline code', () => {
    const md = 'Use `npm install` to install.';
    expect(roundtrip(md)).toBe('Use `npm install` to install.');
  });

  it('preserves bullet lists', () => {
    const md = '- one\n- two\n- three';
    expect(roundtrip(md)).toBe('- one\n- two\n- three');
  });

  it('preserves ordered lists', () => {
    const md = '1. one\n2. two\n3. three';
    expect(roundtrip(md)).toBe('1. one\n2. two\n3. three');
  });

  it('preserves blockquotes', () => {
    const md = '> a quoted line';
    expect(roundtrip(md)).toBe('> a quoted line');
  });

  it('preserves fenced code blocks', () => {
    const md = '```\nconst x = 1;\n```';
    const result = roundtrip(md);
    expect(result).toContain('```');
    expect(result).toContain('const x = 1;');
  });

  it('preserves links', () => {
    const md = 'See [docs](https://example.com).';
    expect(roundtrip(md)).toBe('See [docs](https://example.com).');
  });

  it('handles empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(markdownToHtml('')).toBe('');
  });
});
