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
  let consecutiveLengthHits = 0;
  let consecutiveToolErrors = 0;
  const MAX_CONSECUTIVE_TOOL_ERRORS = 3;

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
        consecutiveLengthHits++;
        if (consecutiveLengthHits >= 3) break;
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
    consecutiveLengthHits = 0;

    // Execute tool calls in parallel
    const ctx: ToolContext = {
      sessionId: opts.sessionId,
      projectPath: opts.projectPath,
      abort,
      skillExecutor: opts.skillExecutor,
      spawnDepth: opts.spawnDepth ?? 0,
      emitChildEvent: opts.emitChildEvent,
      emitConfirmation: opts.emitConfirmation,
    };

    let terminal = false;

    if (abort.aborted) {
      for (const call of response.toolCalls) {
        const cancelOutput = 'Tool call cancelled: the run was stopped by the user before this tool executed.';
        const toolMsg: SessionMessage = {
          id: randomUUID(),
          role: 'tool',
          content: cancelOutput,
          toolResults: [{ toolCallId: call.id, toolName: call.name, output: cancelOutput }],
          createdAt: Date.now(),
        };
        result.push(toolMsg);
        onMessage?.(toolMsg);
      }
      throwIfAborted(abort);
    }

    const toolMessages = await Promise.all(response.toolCalls.map(async (call) => {
      const tool = tools.find(t => t.id === call.name);
      if (!tool) {
        return {
          id: randomUUID(),
          role: 'tool' as const,
          content: `Error: tool "${call.name}" not found`,
          toolResults: [{ toolCallId: call.id, toolName: call.name, output: `Error: tool "${call.name}" not found` }],
          createdAt: Date.now(),
        };
      }

      try {
        let params: any;
        try {
          params = JSON.parse(call.arguments);
        } catch {
          // 某些 provider（如 DashScope/Qwen）偶尔返回畸形 arguments，
          // 例如 "{}{"name":"story",...}" — 尝试提取最后一个有效 JSON 对象
          const lastBrace = call.arguments.lastIndexOf('{');
          if (lastBrace > 0) {
            try {
              params = JSON.parse(call.arguments.slice(lastBrace));
            } catch {
              params = {};
            }
          } else {
            params = {};
          }
          // 修正存储的 arguments，防止畸形字符串进入会话历史导致后续 JSON.parse 报错
          call.arguments = JSON.stringify(params);
        }
        // 兼容某些 provider 将参数作为 JSON 字符串嵌套传入的情况
        if (typeof params === 'string') {
          try { params = JSON.parse(params); } catch { /* 保持原样 */ }
        }
        const toolResult = await tool.execute(params, ctx);
        return {
          id: randomUUID(),
          role: 'tool' as const,
          content: toolResult.output,
          toolResults: [{
            toolCallId: call.id,
            toolName: call.name,
            output: toolResult.output,
            metadata: toolResult.metadata,
          }],
          createdAt: Date.now(),
          _terminal: toolResult.terminal,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error({ tool: call.name, err: errMsg }, 'tool execution failed');
        return {
          id: randomUUID(),
          role: 'tool' as const,
          content: `Error: ${errMsg}`,
          toolResults: [{ toolCallId: call.id, toolName: call.name, output: `Error: ${errMsg}` }],
          createdAt: Date.now(),
        };
      }
    }));

    for (const msg of toolMessages) {
      const { _terminal, ...toolMsg } = msg as any;
      result.push(toolMsg);
      onMessage?.(toolMsg);
      if (_terminal) terminal = true;
    }

    // 检测连续 tool 错误：所有 tool 结果都是 Error 开头则计数
    const allErrors = toolMessages.every((m: any) => m.content?.startsWith('Error:'));
    if (allErrors) {
      consecutiveToolErrors++;
      if (consecutiveToolErrors >= MAX_CONSECUTIVE_TOOL_ERRORS) {
        logger.warn('too many consecutive tool errors, breaking loop');
        break;
      }
    } else {
      consecutiveToolErrors = 0;
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
