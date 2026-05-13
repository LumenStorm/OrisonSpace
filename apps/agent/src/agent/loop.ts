import { randomUUID } from 'node:crypto';
import type { SessionMessage, ToolCall, ToolContext, ToolDefinition } from '../types';
import { registry } from '../tool/registry';
import { logger } from '../logger';

export interface LoopOptions {
  sessionId: string;
  projectPath: string;
  messages: SessionMessage[];
  systemPrompt: string;
  tools: ToolDefinition[];
  maxSteps: number;
  generate: (messages: SessionMessage[], system: string, tools: ToolDefinition[]) => Promise<{
    content: string;
    toolCalls?: ToolCall[];
    finishReason: string;
  }>;
  onMessage?: (msg: SessionMessage) => void;
  abort: AbortSignal;
}

export async function runLoop(opts: LoopOptions): Promise<SessionMessage[]> {
  const { messages, systemPrompt, tools, maxSteps, generate, onMessage, abort } = opts;
  const result: SessionMessage[] = [];
  let steps = 0;

  while (steps < maxSteps) {
    if (abort.aborted) break;
    steps++;

    const response = await generate(
      [...messages, ...result],
      systemPrompt,
      tools,
    );

    const assistantMsg: SessionMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
      createdAt: Date.now(),
    };
    result.push(assistantMsg);
    onMessage?.(assistantMsg);

    if (!response.toolCalls?.length || response.finishReason === 'stop') {
      break;
    }

    // Execute tool calls
    const ctx: ToolContext = {
      sessionId: opts.sessionId,
      projectPath: opts.projectPath,
      abort,
    };

    for (const call of response.toolCalls) {
      if (abort.aborted) break;

      const tool = tools.find(t => t.id === call.name);
      if (!tool) {
        const toolMsg: SessionMessage = {
          id: randomUUID(),
          role: 'tool',
          content: `Error: tool "${call.name}" not found`,
          toolResults: [{ toolCallId: call.id, output: `Error: tool "${call.name}" not found` }],
          createdAt: Date.now(),
        };
        result.push(toolMsg);
        onMessage?.(toolMsg);
        continue;
      }

      try {
        const params = JSON.parse(call.arguments);
        const toolResult = await tool.execute(params, ctx);
        const toolMsg: SessionMessage = {
          id: randomUUID(),
          role: 'tool',
          content: toolResult.output,
          toolResults: [{ toolCallId: call.id, output: toolResult.output }],
          createdAt: Date.now(),
        };
        result.push(toolMsg);
        onMessage?.(toolMsg);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error({ tool: call.name, err: errMsg }, 'tool execution failed');
        const toolMsg: SessionMessage = {
          id: randomUUID(),
          role: 'tool',
          content: `Error: ${errMsg}`,
          toolResults: [{ toolCallId: call.id, output: `Error: ${errMsg}` }],
          createdAt: Date.now(),
        };
        result.push(toolMsg);
        onMessage?.(toolMsg);
      }
    }
  }

  return result;
}
