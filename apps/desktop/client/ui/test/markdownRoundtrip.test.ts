import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, markdownToHtml, isMarkdownRoundTripLossy } from '../src/shared/utils/markdown';

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

describe('isMarkdownRoundTripLossy', () => {
  it('accepts plain prose and StarterKit constructs', () => {
    const md = [
      '# Chapter 1',
      '',
      'A paragraph with **bold**, *italic*, `code` and a [link](https://example.com).',
      '',
      '- a list',
      '- of items',
      '',
      '> a quote',
      '',
      '```',
      'fenced code',
      '```',
    ].join('\n');
    expect(isMarkdownRoundTripLossy(md)).toBe(false);
  });

  it('handles empty input', () => {
    expect(isMarkdownRoundTripLossy('')).toBe(false);
  });

  it('flags GFM tables', () => {
    const md = 'Intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n';
    expect(isMarkdownRoundTripLossy(md)).toBe(true);
  });

  it('flags images', () => {
    expect(isMarkdownRoundTripLossy('Text with ![alt](assets/pic.png) inline.')).toBe(true);
  });

  it('flags YAML front-matter', () => {
    expect(isMarkdownRoundTripLossy('---\ntitle: x\n---\n\nBody text.')).toBe(true);
  });

  it('flags structural raw HTML', () => {
    expect(isMarkdownRoundTripLossy('Before\n\n<div class="note">html block</div>\n\nAfter')).toBe(true);
    expect(isMarkdownRoundTripLossy('<table><tr><td>x</td></tr></table>')).toBe(true);
  });

  it('does not flag table-like lines separated by blank paragraphs', () => {
    // What TipTap produces when a user types pipe characters as plain prose:
    // paragraphs, not a table. marked never parses these as a table, so the
    // delimiter-row count survives the round-trip.
    const md = '| a |\n\n| - |\n\n| b |';
    expect(isMarkdownRoundTripLossy(md)).toBe(false);
  });

  it('does not flag image/table syntax inside code fences', () => {
    const md = 'Example:\n\n```\n![alt](x.png)\n| a | b |\n| - | - |\n```';
    expect(isMarkdownRoundTripLossy(md)).toBe(false);
  });

  it('does not flag horizontal rules mid-document', () => {
    expect(isMarkdownRoundTripLossy('Part one\n\n---\n\nPart two')).toBe(false);
  });
});
