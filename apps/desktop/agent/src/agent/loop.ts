import { randomUUID } from 'node:crypto';
import type { ChildStreamEvent, SessionMessage, SkillExecutorRef, ToolCall, ToolContext, ToolDefinition } from '../types';
import type { CacheConfig, ContextState } from '../context/contextManager';
import type { SummarizationGenerateFn } from '../context/summarizer';
import type { PinnedContextItem } from '../context/pinnedContext';
import { prepareContext, createDefaultContextState } from '../context/contextManager';
import { logger } from '../logger';

export interface LoopOptions {
  sessionId: string;
  projectPath: string;
  messages: SessionMessage[];
  systemPrompt: string;
  tools: ToolDefinition[];
  maxSteps: number;
  generate: (messages: SessionMessage[], system: string, tools: ToolDefinition[], abort: AbortSignal, cacheConfig?: CacheConfig) => Promise<{
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
  contextState?: ContextState;
  pinnedContext?: PinnedContextItem[];
  onContextStateUpdate?: (state: ContextState) => void;
  onCompaction?: (compactedCount: number) => void;
}

export async function runLoop(opts: LoopOptions): Promise<SessionMessage[]> {
  const { systemPrompt, tools, maxSteps, generate, onMessage, abort } = opts;
  const result: SessionMessage[] = [];
  let steps = 0;
  let contextState = opts.contextState ?? createDefaultContextState();

  // Snapshot the base messages at entry — `opts.messages` may be a live reference
  // to session.messages that gets mutated by onMessage → addMessage. We must NOT
  // re-read it on each iteration.
  let baseMessages: SessionMessage[] = [...opts.messages];

  // Build a summarization generate function that reuses the same model (no tools)
  const summarizationGenerate: SummarizationGenerateFn = async (msgs, system, abortSignal) => {
    const res = await generate(msgs, system, [], abortSignal);
    return { content: res.content };
  };

  while (steps < maxSteps) {
    throwIfAborted(abort);
    steps++;

    // --- Context management: check budget and compact if needed ---
    let allMessages = [...baseMessages, ...result];

    const prepared = await prepareContext({
      systemPrompt,
      messages: allMessages,
      contextState,
      pinnedContext: opts.pinnedContext,
      generate: summarizationGenerate,
      abort,
    });

    if (prepared.compactionOccurred) {
      // After compaction, `prepared.messages` is the retained tail.
      // We need to replace both `baseMessages` and `result` with this new set
      // so that subsequent iterations only see the compacted view.
      // Split retained messages back: those from the original base vs those from result.
      const baseIds = new Set(baseMessages.map(m => m.id));
      const newBase = prepared.messages.filter(m => baseIds.has(m.id));
      const newResult = prepared.messages.filter(m => !baseIds.has(m.id));

      baseMessages = newBase;
      result.splice(0, result.length, ...newResult);
      allMessages = prepared.messages;
      contextState = prepared.contextState;
      opts.onContextStateUpdate?.(contextState);
      opts.onCompaction?.(prepared.compactedCount);
      logger.info({ compactedCount: prepared.compactedCount }, 'in-loop compaction applied');
    }

    const cacheConfig = prepared.cacheConfig;

    const response = await generate(
      allMessages,
      systemPrompt,
      tools,
      abort,
      cacheConfig,
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
