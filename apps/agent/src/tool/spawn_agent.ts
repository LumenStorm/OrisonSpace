import { z } from 'zod';
import { defineTool } from './define';

export const spawnAgentTool = defineTool({
  id: 'spawn_agent',
  description: 'Spawn a focused subagent (e.g. story-architect, character-designer) to complete a specialized task. The subagent runs in its own child session with full tool access, then returns its final answer. Use when a skill explicitly asks you to dispatch a subagent, or when a sub-task benefits from a dedicated focused agent.',
  parameters: z.object({
    agentType: z.string().describe('Role / type of the subagent (e.g. "story-architect", "narrative-writer", "consistency-checker")'),
    prompt: z.string().describe('Task description and all relevant context for the subagent — it does not share your conversation history'),
  }),
  async execute(params, ctx) {
    if (!ctx.skillExecutor) {
      return {
        title: `spawn_agent: ${params.agentType}`,
        output: 'Subagent dispatch is unavailable in this context (no runtime bound).',
      };
    }
    try {
      const result = await ctx.skillExecutor.runSubagent(
        ctx.sessionId,
        params.agentType,
        params.prompt,
        {
          abort: ctx.abort,
          spawnDepth: ctx.spawnDepth ?? 0,
          emitChildEvent: ctx.emitChildEvent,
        },
      );
      return {
        title: `spawn_agent: ${params.agentType}`,
        output: result.content || `Subagent "${params.agentType}" completed without output.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        title: `spawn_agent: ${params.agentType}`,
        output: `Subagent "${params.agentType}" failed: ${message}`,
      };
    }
  },
});
