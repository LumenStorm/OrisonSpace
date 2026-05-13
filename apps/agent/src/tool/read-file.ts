import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from './define';

export const readFileTool = defineTool({
  id: 'read_file',
  description: 'Read the contents of a file within the project directory.',
  parameters: z.object({
    filePath: z.string().describe('Relative path from project root'),
    offset: z.number().int().nonnegative().optional().describe('Line offset (0-indexed)'),
    limit: z.number().int().positive().optional().describe('Max lines to read'),
  }),
  async execute(params, ctx) {
    const fullPath = path.resolve(ctx.projectPath, params.filePath);
    if (!fullPath.startsWith(ctx.projectPath)) {
      throw new Error('Path traversal not allowed');
    }

    const content = await readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 2000;
    const slice = lines.slice(offset, offset + limit);
    const numbered = slice.map((line, i) => `${offset + i + 1}\t${line}`).join('\n');

    return {
      title: params.filePath,
      output: numbered,
      metadata: { totalLines: lines.length, returned: slice.length },
    };
  },
});
