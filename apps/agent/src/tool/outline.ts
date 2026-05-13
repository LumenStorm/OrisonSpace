import { z } from 'zod';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { defineTool } from './define';

export const outlineReadTool = defineTool({
  id: 'outline_read',
  description: 'Read the story outline. Looks for outlines/ directory or a single outline.yaml/outline.md file.',
  parameters: z.object({
    file: z.string().optional().describe('Specific outline file to read (relative to outlines/)'),
  }),
  async execute(params, ctx) {
    const outlineDir = path.join(ctx.projectPath, 'outlines');

    if (params.file) {
      const filePath = path.join(outlineDir, params.file);
      if (!filePath.startsWith(ctx.projectPath)) throw new Error('Path traversal not allowed');
      const content = await readFile(filePath, 'utf-8');
      return { title: `outline: ${params.file}`, output: content };
    }

    // List all outline files
    let entries: string[];
    try {
      entries = await readdir(outlineDir);
    } catch {
      // Try single file at project root
      for (const name of ['outline.yaml', 'outline.md', 'outline.json']) {
        try {
          const content = await readFile(path.join(ctx.projectPath, name), 'utf-8');
          return { title: `outline: ${name}`, output: content };
        } catch { /* next */ }
      }
      return { title: 'outline_read', output: 'No outline files found.' };
    }

    const files = entries.filter(f => /\.(md|yaml|yml|json)$/.test(f)).sort();
    if (files.length === 1) {
      const content = await readFile(path.join(outlineDir, files[0]), 'utf-8');
      return { title: `outline: ${files[0]}`, output: content };
    }

    return {
      title: 'outline_read',
      output: `Found ${files.length} outline files:\n${files.join('\n')}\n\nUse file parameter to read a specific one.`,
    };
  },
});

export const outlineUpdateTool = defineTool({
  id: 'outline_update',
  description: 'Update or create an outline file in the outlines/ directory.',
  parameters: z.object({
    file: z.string().describe('Outline file name (e.g. "main.yaml", "arc-1.md")'),
    content: z.string().describe('Full outline content'),
  }),
  async execute(params, ctx) {
    const outlineDir = path.join(ctx.projectPath, 'outlines');
    await mkdir(outlineDir, { recursive: true });
    const filePath = path.join(outlineDir, params.file);
    if (!filePath.startsWith(ctx.projectPath)) throw new Error('Path traversal not allowed');

    await writeFile(filePath, params.content, 'utf-8');
    return {
      title: `outline_update: ${params.file}`,
      output: `Updated outline: ${params.file}`,
    };
  },
});
