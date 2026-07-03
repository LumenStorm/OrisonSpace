import { z } from 'zod';
import { defineTool } from './define';
import type { SkillExecutionResult } from '../types';

export const skillTool = defineTool({
  id: 'skill',
  description: 'Execute a skill workflow by name. The skill\'s instructions and reference files are loaded, its workflow runs to completion (or until a checkpoint), and the outputs / checkpoints / pending confirmations are returned. Use this whenever the user\'s request matches a skill\'s trigger keywords.',
  parameters: z.object({
    name: z.string().describe('Name of the skill to execute (must match an entry in Available Skills)'),
    input: z.string().optional().describe('Optional natural-language request to pass to the skill (e.g. user message, parameters)'),
  }),
  async execute(params, ctx) {
    if (!ctx.skillExecutor) {
      return {
        title: `skill: ${params.name ?? '(unknown)'}`,
        output: 'Skill execution is unavailable in this context (no runtime bound).',
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

    // 技能内部执行时禁止递归调用 skill，引导模型直接完成任务
    if ((ctx.spawnDepth ?? 0) > 0) {
      return {
        title: `skill: ${params.name}`,
        output: `You are already executing inside a skill. Do NOT call the skill tool again. Complete the task directly using the available tools (read_file, chapter_write, etc.).`,
      };
    }

    try {
      const result = await ctx.skillExecutor.executeSkillByName(
        ctx.sessionId,
        params.name,
        params.input,
        {
          abort: ctx.abort,
          spawnDepth: ctx.spawnDepth ?? 0,
          emitChildEvent: ctx.emitChildEvent,
          emitConfirmation: ctx.emitConfirmation,
        },
      );
      if (ctx.emitConfirmation) {
        for (const pending of result.pendingConfirmations) {
          ctx.emitConfirmation(pending as Parameters<NonNullable<typeof ctx.emitConfirmation>>[0]);
        }
      }
      return {
        title: `skill: ${params.name}`,
        output: renderResult(result),
        terminal: true,
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
        output: `Skill "${params.name}" failed: ${message}`,
      };
    }
  },
});

function renderResult(result: SkillExecutionResult): string {
  const sections: string[] = [];
  if (result.outputs.length > 0) {
    sections.push(result.outputs.join('\n\n'));
  }
  if (result.checkpoints.length > 0) {
    sections.push(`Checkpoints: ${result.checkpoints.join(', ')}`);
  }
  if (result.pendingConfirmations.length > 0) {
    sections.push(`Pending confirmations: ${result.pendingConfirmations.map((item) => item.name).join(', ')}`);
  }
  if (result.nested.length > 0) {
    sections.push(`Nested skills invoked: ${result.nested.map((item) => item.skill).join(', ')}`);
  }
  return sections.join('\n\n') || `Skill "${result.skill}" completed.`;
}
