import { z } from 'zod';
import { defineTool } from './define';
import { renderSkillPayload } from '../skill/payload';

export const skillTool = defineTool({
  id: 'skill',
  description: 'Load a skill by exact name. Returns the full SKILL.md instructions and resource list into the conversation; continue the task using those instructions and explicit tools.',
  parameters: z.object({
    name: z.string().describe('Exact name of the skill to load (must match an entry in Available Skills)'),
    input: z.string().optional().describe('Optional note about why this skill is being loaded'),
  }),
  async execute(params, ctx) {
    if (!ctx.skillExecutor) {
      return {
        title: `skill: ${params.name ?? '(unknown)'}`,
        output: 'Skill loading is unavailable in this context (no runtime bound).',
      };
    }

    // 渐次披露：name 缺失时，列出可用 skill 概要让模型自行选择
    if (!params.name) {
      const available = await ctx.skillExecutor.listSkillNames?.(ctx.sessionId);
      if (available && available.length > 0) {
        return {
          title: 'skill: discover',
          output: [
            'No skill name was provided. Here are the available skills:',
            '',
            ...available.map(n => `- ${n}`),
            '',
            'To invoke a skill, call this tool again with the `name` parameter set to one of the above identifiers.',
          ].join('\n'),
        };
      }
      return {
        title: 'skill: discover',
        output: 'No skill name was provided and no skills are currently loaded for this session.',
      };
    }

    try {
      const skill = await ctx.skillExecutor.loadSkill?.(ctx.sessionId, params.name);
      if (!skill) {
        throw new Error(`skill "${params.name}" not found`);
      }
      return {
        title: `skill: ${params.name}`,
        output: renderSkillPayload(skill),
        metadata: {
          activeSkill: {
            name: skill.name,
            allowedTools: skill.allowedTools,
            permission: skill.permission,
          },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // skill 找不到时，渐次披露可用列表引导模型重试
      if (message.includes('not found')) {
        const available = await ctx.skillExecutor.listSkillNames?.(ctx.sessionId);
        if (available && available.length > 0) {
          return {
            title: `skill: ${params.name}`,
            output: [
              `Skill "${params.name}" was not found.`,
              '',
              'Available skills:',
              ...available.map(n => `- ${n}`),
              '',
              'Please call this tool again with `name` set to one of the above.',
            ].join('\n'),
          };
        }
      }
      return {
        title: `skill: ${params.name}`,
        output: `Skill "${params.name}" failed to load: ${message}`,
      };
    }
  },
});
