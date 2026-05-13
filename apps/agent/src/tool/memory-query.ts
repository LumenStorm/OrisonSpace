import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { defineTool } from './define';

export const memoryQueryTool = defineTool({
  id: 'memory_query',
  description: 'Query the story memory (story-memory.yaml) for characters, events, world-building, etc.',
  parameters: z.object({
    section: z.string().optional().describe('Section to query (e.g. "characters", "events", "world")'),
    query: z.string().optional().describe('Search term within the section'),
  }),
  async execute(params, ctx) {
    const memPath = path.join(ctx.projectPath, 'story-memory.yaml');
    let content: string;
    try {
      content = await readFile(memPath, 'utf-8');
    } catch {
      return { title: 'memory_query', output: 'No story-memory.yaml found in project.' };
    }

    const data = YAML.parse(content) as Record<string, unknown>;

    if (params.section) {
      const section = data[params.section];
      if (!section) {
        return { title: 'memory_query', output: `Section "${params.section}" not found. Available: ${Object.keys(data).join(', ')}` };
      }
      const text = YAML.stringify(section);
      if (params.query) {
        const lines = text.split('\n').filter(l => l.toLowerCase().includes(params.query!.toLowerCase()));
        return { title: `memory: ${params.section}`, output: lines.join('\n') || 'No matches' };
      }
      return { title: `memory: ${params.section}`, output: text };
    }

    return { title: 'memory_query', output: YAML.stringify(data) };
  },
});
