import { z } from 'zod';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from './define';

export const chapterListTool = defineTool({
  id: 'chapter_list',
  description: 'List all chapters in the project with their metadata (title, status, word count).',
  parameters: z.object({}),
  async execute(_params, ctx) {
    const chapDir = path.join(ctx.projectPath, 'chapters');
    let entries: string[];
    try {
      entries = await readdir(chapDir);
    } catch {
      return { title: 'chapter_list', output: 'No chapters/ directory found.' };
    }

    const mdFiles = entries.filter(f => f.endsWith('.md')).sort();
    const results: string[] = [];

    for (const file of mdFiles) {
      const content = await readFile(path.join(chapDir, file), 'utf-8');
      const lines = content.split('\n');
      const title = lines.find(l => l.startsWith('# '))?.slice(2).trim() ?? file;
      const wordCount = content.replace(/[#\-*_>\[\]()]/g, '').split(/\s+/).filter(Boolean).length;
      results.push(`${file} | ${title} | ${wordCount} words`);
    }

    return {
      title: 'chapter_list',
      output: results.length > 0 ? results.join('\n') : 'No chapter files found.',
      metadata: { count: results.length },
    };
  },
});

export const chapterReadTool = defineTool({
  id: 'chapter_read',
  description: 'Read the full content of a specific chapter file.',
  parameters: z.object({
    fileName: z.string().describe('Chapter file name (e.g. "01-opening.md") or chapter number'),
  }),
  async execute(params, ctx) {
    const chapDir = path.join(ctx.projectPath, 'chapters');
    let filePath: string;

    if (params.fileName.endsWith('.md')) {
      filePath = path.join(chapDir, params.fileName);
    } else {
      // Try to find by number prefix
      const entries = await readdir(chapDir);
      const match = entries.find(f => f.startsWith(params.fileName) && f.endsWith('.md'));
      filePath = match ? path.join(chapDir, match) : path.join(chapDir, `${params.fileName}.md`);
    }

    if (!filePath.startsWith(ctx.projectPath)) throw new Error('Path traversal not allowed');

    const content = await readFile(filePath, 'utf-8');
    return { title: `chapter: ${path.basename(filePath)}`, output: content };
  },
});

export const chapterWriteTool = defineTool({
  id: 'chapter_write',
  description: 'Write or update a chapter file. Creates the chapters/ directory if needed.',
  parameters: z.object({
    fileName: z.string().describe('Chapter file name (e.g. "01-opening.md")'),
    content: z.string().describe('Full chapter content in markdown'),
  }),
  async execute(params, ctx) {
    const chapDir = path.join(ctx.projectPath, 'chapters');
    await mkdir(chapDir, { recursive: true });
    const filePath = path.join(chapDir, params.fileName);
    if (!filePath.startsWith(ctx.projectPath)) throw new Error('Path traversal not allowed');

    await writeFile(filePath, params.content, 'utf-8');
    const wordCount = params.content.split(/\s+/).filter(Boolean).length;

    return {
      title: `chapter_write: ${params.fileName}`,
      output: `Wrote ${params.fileName} (${wordCount} words)`,
      metadata: { wordCount },
    };
  },
});
