import { z } from 'zod';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from './define';

export const searchTool = defineTool({
  id: 'search',
  description: 'Search for text content across project files using a regex pattern.',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    dirPath: z.string().optional().describe('Directory to search in'),
    filePattern: z.string().optional().describe('File extension filter (e.g. "*.md")'),
  }),
  async execute(params, ctx) {
    const fullPath = path.resolve(ctx.projectPath, params.dirPath ?? '.');
    if (!fullPath.startsWith(ctx.projectPath)) {
      throw new Error('Path traversal not allowed');
    }

    const regex = new RegExp(params.pattern, 'gi');
    const entries = await readdir(fullPath, { withFileTypes: true, recursive: true });
    let files = entries.filter(e => e.isFile());

    if (params.filePattern) {
      const ext = params.filePattern.startsWith('*.') ? params.filePattern.slice(1) : null;
      if (ext) files = files.filter(f => f.name.endsWith(ext));
    }

    const results: string[] = [];
    const maxResults = 50;

    for (const entry of files) {
      if (results.length >= maxResults) break;
      const filePath = path.join(entry.parentPath ?? fullPath, entry.name);
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const rel = path.relative(ctx.projectPath, filePath);
            results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
            if (results.length >= maxResults) break;
          }
          regex.lastIndex = 0;
        }
      } catch {
        // skip unreadable files
      }
    }

    return {
      title: `search: ${params.pattern}`,
      output: results.length > 0 ? results.join('\n') : 'No matches found',
      metadata: { matchCount: results.length },
    };
  },
});
