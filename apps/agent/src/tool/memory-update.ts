import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { defineTool } from './define';

export const memoryUpdateTool = defineTool({
  id: 'memory_update',
  description: 'Update the story memory (story-memory.yaml). Merges data into the specified section.',
  parameters: z.object({
    section: z.string().describe('Section to update (e.g. "characters", "events", "world")'),
    key: z.string().describe('Key within the section'),
    value: z.unknown().describe('Value to set'),
  }),
  async execute(params, ctx) {
    const memPath = path.join(ctx.projectPath, 'story-memory.yaml');
    let data: Record<string, unknown> = {};
    try {
      const content = await readFile(memPath, 'utf-8');
      data = (YAML.parse(content) as Record<string, unknown>) ?? {};
    } catch {
      // file doesn't exist yet
    }

    if (!data[params.section] || typeof data[params.section] !== 'object') {
      data[params.section] = {};
    }
    (data[params.section] as Record<string, unknown>)[params.key] = params.value;

    await writeFile(memPath, YAML.stringify(data), 'utf-8');

    return {
      title: `memory_update: ${params.section}.${params.key}`,
      output: `Updated ${params.section}.${params.key}`,
    };
  },
});
