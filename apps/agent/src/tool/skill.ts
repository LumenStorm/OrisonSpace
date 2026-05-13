import { z } from 'zod';
import path from 'node:path';
import { defineTool } from './define';
import { discoverSkills } from '../skill/discovery';
import { parseSkillFile } from '../skill/loader';
import { readFile } from 'node:fs/promises';

export const skillTool = defineTool({
  id: 'skill',
  description: 'Load a skill by name and inject its prompt into the conversation context.',
  parameters: z.object({
    name: z.string().describe('Name of the skill to load'),
  }),
  async execute(params, ctx) {
    const skillsDir = path.join(ctx.projectPath, '.orison', 'skills');
    const skills = await discoverSkills(skillsDir);
    const skill = skills.find(s => s.name === params.name);

    if (!skill) {
      const available = skills.map(s => s.name).join(', ');
      return {
        title: 'skill',
        output: `Skill "${params.name}" not found. Available: ${available || 'none'}`,
      };
    }

    return {
      title: `skill: ${skill.name}`,
      output: skill.content,
    };
  },
});
