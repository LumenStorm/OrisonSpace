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
        title: `skill: ${params.name}`,
        output: 'Skill execution is unavailable in this context (no runtime bound).',
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
        },
      );
      return {
        title: `skill: ${params.name}`,
        output: renderResult(result),
        // skill 内部已经把引导/产物流式说给用户了，这份输出即最终答复。
        // 标记 terminal，阻止父循环就同样内容再生成一轮重复回复。
        terminal: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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
