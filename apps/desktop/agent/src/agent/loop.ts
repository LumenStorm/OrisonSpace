import { randomUUID } from 'node:crypto';
import type { ChildStreamEvent, SessionMessage, SkillExecutorRef, ToolCall, ToolContext, ToolDefinition } from '../types';
import { registry } from '../tool/registry';
import { logger } from '../logger';

export interface LoopOptions {
  sessionId: string;
  projectPath: string;
  messages: SessionMessage[];
  systemPrompt: string;
  tools: ToolDefinition[];
  maxSteps: number;
  generate: (messages: SessionMessage[], system: string, tools: ToolDefinition[], abort: AbortSignal) => Promise<{
    content: string;
    toolCalls?: ToolCall[];
    finishReason: string;
  }>;
  onMessage?: (msg: SessionMessage) => void;
  abort: AbortSignal;
  skillExecutor?: SkillExecutorRef;
  spawnDepth?: number;
  emitChildEvent?: (event: ChildStreamEvent) => void;
  emitConfirmation?: (pending: import('../types').PendingConfirmationState) => void;
}

export async function runLoop(opts: LoopOptions): Promise<SessionMessage[]> {
  const { messages, systemPrompt, tools, maxSteps, generate, onMessage, abort } = opts;
  const result: SessionMessage[] = [];
  let steps = 0;

  while (steps < maxSteps) {
    throwIfAborted(abort);
    steps++;

    const response = await generate(
      [...messages, ...result],
      systemPrompt,
      tools,
      abort,
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

    if (!response.toolCalls?.length) {
      if (response.finishReason === 'length') {
        // Output truncated — inject continuation prompt to keep going
        const contMsg: SessionMessage = {
          id: randomUUID(),
          role: 'user',
          content: 'Continue from where you left off. Execute the next step using the appropriate tool.',
          createdAt: Date.now(),
        };
        result.push(contMsg);
        onMessage?.(contMsg);
        continue;
      }
      break;
    }

    // Execute tool calls
    const ctx: ToolContext = {
      sessionId: opts.sessionId,
      projectPath: opts.projectPath,
      abort,
      skillExecutor: opts.skillExecutor,
      spawnDepth: opts.spawnDepth ?? 0,
      emitChildEvent: opts.emitChildEvent,
      emitConfirmation: opts.emitConfirmation,
    };

    // 某些工具（如 skill）已经把最终答复流式说给用户了，其结果标记为 terminal。
    // 这种情况下本轮工具结果照常持久化，但不再让模型就同样内容生成重复收尾。
    let terminal = false;

    for (let i = 0; i < response.toolCalls.length; i++) {
      const call = response.toolCalls[i];
      // If aborted mid-loop, synthesize cancelled results for this call and all
      // remaining calls so every tool_call in the assistant message stays paired
      // with a tool result. An assistant turn persisted with unmatched tool_calls
      // makes the next request invalid ("Tool result is missing for tool call").
      if (abort.aborted) {
        for (let j = i; j < response.toolCalls.length; j++) {
          const pending = response.toolCalls[j];
          const cancelOutput = 'Tool call cancelled: the run was stopped by the user before this tool executed.';
          const toolMsg: SessionMessage = {
            id: randomUUID(),
            role: 'tool',
            content: cancelOutput,
            toolResults: [{ toolCallId: pending.id, toolName: pending.name, output: cancelOutput }],
            createdAt: Date.now(),
          };
          result.push(toolMsg);
          onMessage?.(toolMsg);
        }
        throwIfAborted(abort);
      }

      const tool = tools.find(t => t.id === call.name);
      if (!tool) {
        const toolMsg: SessionMessage = {
          id: randomUUID(),
          role: 'tool',
          content: `Error: tool "${call.name}" not found`,
          toolResults: [{ toolCallId: call.id, toolName: call.name, output: `Error: tool "${call.name}" not found` }],
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
          toolResults: [{
            toolCallId: call.id,
            toolName: call.name,
            output: toolResult.output,
            metadata: toolResult.metadata,
          }],
          createdAt: Date.now(),
        };
        result.push(toolMsg);
        onMessage?.(toolMsg);
        if (toolResult.terminal) {
          terminal = true;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error({ tool: call.name, err: errMsg }, 'tool execution failed');
        const toolMsg: SessionMessage = {
          id: randomUUID(),
          role: 'tool',
          content: `Error: ${errMsg}`,
          toolResults: [{ toolCallId: call.id, toolName: call.name, output: `Error: ${errMsg}` }],
          createdAt: Date.now(),
        };
        result.push(toolMsg);
        onMessage?.(toolMsg);
      }
    }

    // 本轮存在 terminal 工具（如 skill）：它已直接对用户说完话，
    // 不再让模型基于同样的 tool 结果生成一段重复收尾，直接结束本次运行。
    if (terminal) {
      break;
    }
  }

  return result;
}

function throwIfAborted(abort: AbortSignal): void {
  if (abort.aborted) {
    throw abort.reason instanceof DOMException
      ? abort.reason
      : new DOMException('Aborted', 'AbortError');
  }
}
