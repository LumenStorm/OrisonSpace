import { describe, expect, it, vi } from 'vitest';
import {
  buildDocxPackage,
  buildMarkdownManuscript,
  buildPlainTextManuscript,
  exportFilename,
  type ChapterManuscript,
} from '../src/shared/export/exportBuilder';

describe('exportBuilder', () => {
  const chapters: ChapterManuscript[] = [
    {
      title: '开篇',
      body: '# 开篇\n\n<p>第一段<strong>钩子</strong></p>\n\n![图](cover.png)\n\n**重点**',
    },
    {
      title: '第2章 转折',
      body: '<p>第二章正文</p>\n<p>无 HTML 残留</p>',
    },
  ];

  it('builds chaptered plain text without markdown or HTML tags', () => {
    const text = buildPlainTextManuscript(chapters);

    expect(text).toBe([
      '第1章 开篇',
      '',
      '第一段钩子',
      '',
      '重点',
      '',
      '第2章 转折',
      '',
      '第二章正文',
      '',
      '无 HTML 残留',
    ].join('\n'));
    expect(text).not.toContain('<p>');
    expect(text).not.toContain('![图]');
  });

  it('keeps markdown export chaptered and separated', () => {
    const markdown = buildMarkdownManuscript(chapters);
    expect(markdown).toContain('# 开篇\n\n<p>第一段');
    expect(markdown).not.toContain('# 开篇\n\n# 开篇');
    expect(buildMarkdownManuscript(chapters)).toContain('\n\n---\n\n# 第2章 转折');
  });

  it('builds a Word-openable docx package', () => {
    const bytes = buildDocxPackage(chapters);
    const raw = new TextDecoder().decode(bytes);

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(raw).toContain('word/document.xml');
    expect(raw).toContain('第1章 开篇');
    expect(raw).toContain('第二章正文');
  });

  it('uses project name and current date for export filenames', () => {
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    expect(exportFilename('我的:项目', 'txt')).toBe('我的_项目-2026-07-09.txt');
    vi.useRealTimers();
  });
});
