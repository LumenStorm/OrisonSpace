import { z } from 'zod';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from './define';

export const listFilesTool = defineTool({
  id: 'list_files',
  description: 'List files in a directory matching an optional glob pattern.',
  parameters: z.object({
    dirPath: z.string().optional().describe('Relative directory path'),
    pattern: z.string().optional().describe('Glob pattern to filter (simple suffix match)'),
  }),
  async execute(params, ctx) {
    const fullPath = path.resolve(ctx.projectPath, params.dirPath ?? '.');
    if (!fullPath.startsWith(ctx.projectPath)) {
      throw new Error('Path traversal not allowed');
    }

    const entries = await readdir(fullPath, { withFileTypes: true, recursive: true });
    let files = entries
      .filter(e => e.isFile())
      .map(e => path.relative(ctx.projectPath, path.join(e.parentPath ?? fullPath, e.name)));

    if (params.pattern) {
      const ext = params.pattern.startsWith('*.') ? params.pattern.slice(1) : null;
      if (ext) {
        files = files.filter(f => f.endsWith(ext));
      }
    }

    const limited = files.slice(0, 200);
    const output = limited.join('\n') || 'No files found';

    return {
      title: params.dirPath ?? '.',
      output: files.length > 200 ? output + `\n\n(truncated, ${files.length} total)` : output,
      metadata: { count: files.length },
    };
  },
});
