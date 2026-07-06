import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { listSkillResourcePaths } from '../skill/payload';
import type { NormalizedSkill } from '../skill/types';
import type { ToolContext } from '../types';
import { defineTool } from './define';

export const skillResourceListTool = defineTool({
  id: 'skill_resource_list',
  description: 'List resources available inside a loaded skill directory.',
  parameters: z.object({
    skill: z.string().describe('Exact skill name'),
  }),
  async execute(params, ctx) {
    const skill = await loadSkill(ctx, params.skill);
    const resources = listSkillResourcePaths(skill);
    return {
      title: `skill_resource_list: ${skill.name}`,
      output: resources.length ? resources.map((resource) => `- ${resource}`).join('\n') : '(no resources)',
    };
  },
});

export const skillResourceReadTool = defineTool({
  id: 'skill_resource_read',
  description: 'Read one registered resource file from inside a skill directory.',
  parameters: z.object({
    skill: z.string().describe('Exact skill name'),
    path: z.string().describe('Resource path from the skill root, as shown by skill_resource_list or the loaded skill payload'),
  }),
  async execute(params, ctx) {
    const skill = await loadSkill(ctx, params.skill);
    const resourcePath = resolveRegisteredResource(skill, params.path);
    const content = await readFile(resourcePath, 'utf-8');
    const relative = path.relative(skill.location, resourcePath).replace(/\\/g, '/');
    return {
      title: `skill_resource_read: ${skill.name}/${relative}`,
      output: content,
    };
  },
});

async function loadSkill(ctx: ToolContext, skillName: string): Promise<NormalizedSkill> {
  const skill = await ctx.skillExecutor?.loadSkill?.(ctx.sessionId, skillName);
  if (!skill) {
    throw new Error(`skill "${skillName}" not found`);
  }
  return skill;
}

function resolveRegisteredResource(skill: NormalizedSkill, requestedPath: string): string {
  if (path.isAbsolute(requestedPath)) {
    throw new Error(`"${requestedPath}" is not a registered resource for skill "${skill.name}"`);
  }

  const normalizedRequest = path.normalize(requestedPath.replace(/\\/g, path.sep));
  if (normalizedRequest === '..' || normalizedRequest.startsWith(`..${path.sep}`)) {
    throw new Error(`"${requestedPath}" is not a registered resource for skill "${skill.name}"`);
  }

  const resolved = path.resolve(skill.location, normalizedRequest);
  const allowed = allResourcePaths(skill).map((resource) => path.resolve(resource));
  const match = allowed.find((resource) => samePath(resource, resolved));
  if (!match) {
    throw new Error(`"${requestedPath}" is not a registered resource for skill "${skill.name}"`);
  }
  return match;
}

function allResourcePaths(skill: NormalizedSkill): string[] {
  return [
    ...skill.assets.references,
    ...skill.assets.scripts,
    ...(skill.assets.assets ?? []),
  ];
}

function samePath(left: string, right: string): boolean {
  if (process.platform === 'win32') {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}
