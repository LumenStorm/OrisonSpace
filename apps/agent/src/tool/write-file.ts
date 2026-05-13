import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from './define';

export const writeFileTool = defineTool({
  id: 'write_file',
  description: 'Write content to a file within the project directory. Creates directories as needed.',
  parameters: z.object({
    filePath: z.string().describe('Relative path from project root'),
    content: z.string().describe('File content to write'),
  }),
  async execute(params, ctx) {
    const fullPath = path.resolve(ctx.projectPath, params.filePath);
    if (!fullPath.startsWith(ctx.projectPath)) {
      throw new Error('Path traversal not allowed');
    }

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, params.content, 'utf-8');

    return {
      title: params.filePath,
      output: `Wrote ${params.content.length} chars to ${params.filePath}`,
    };
  },
});
