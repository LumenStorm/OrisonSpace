import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { defineTool } from './define';

export const projectMetaTool = defineTool({
  id: 'project_meta',
  description: 'Read project metadata: configuration, style settings, world-building summary, and project structure overview.',
  parameters: z.object({
    section: z.string().optional().describe('Specific section: "config", "style", "world", "structure"'),
  }),
  async execute(params, ctx) {
    const results: string[] = [];

    if (!params.section || params.section === 'config') {
      for (const name of ['orison.yaml', 'orison.json', '.orison/config.yaml']) {
        try {
          const content = await readFile(path.join(ctx.projectPath, name), 'utf-8');
          results.push(`## Project Config (${name})\n${content}`);
          break;
        } catch { /* next */ }
      }
    }

    if (!params.section || params.section === 'style') {
      for (const name of ['style-guide.md', '.orison/style.md']) {
        try {
          const content = await readFile(path.join(ctx.projectPath, name), 'utf-8');
          results.push(`## Style Guide\n${content}`);
          break;
        } catch { /* next */ }
      }
    }

    if (!params.section || params.section === 'world') {
      try {
        const mem = await readFile(path.join(ctx.projectPath, 'story-memory.yaml'), 'utf-8');
        const data = YAML.parse(mem) as Record<string, unknown>;
        if (data.world) {
          results.push(`## World Building\n${YAML.stringify(data.world)}`);
        }
      } catch { /* no memory file */ }
    }

    if (!params.section || params.section === 'structure') {
      const { readdir } = await import('node:fs/promises');
      const topLevel = await readdir(ctx.projectPath, { withFileTypes: true });
      const dirs = topLevel.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => `📁 ${e.name}/`);
      const files = topLevel.filter(e => e.isFile()).map(e => `📄 ${e.name}`);
      results.push(`## Project Structure\n${[...dirs, ...files].join('\n')}`);
    }

    return {
      title: 'project_meta',
      output: results.length > 0 ? results.join('\n\n') : 'No project metadata found.',
    };
  },
});
