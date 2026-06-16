import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runLoop } from '../src/agent/loop';
import type { SessionMessage, ToolCall, ToolDefinition } from '../src/types';

/**
 * Regression: 一个 terminal 工具（如 skill）已经把最终答复直接流式说给用户，
 * 主循环不得就同样的 tool 结果再生成一轮收尾回复——否则用户会看到两段重复内容。
 */
describe('runLoop terminal tool', () => {
  const terminalTool: ToolDefinition = {
    id: 'skill',
    description: 'terminal skill',
    parameters: z.object({}),
    execute: async () => ({ title: 'skill', output: 'skill 已经回答用户了', terminal: true }),
  };

  const plainTool: ToolDefinition = {
    id: 'echo',
    description: 'echo',
    parameters: z.object({}),
    execute: async () => ({ title: 'echo', output: 'ran' }),
  };

  function toolCall(id: string, name: string): ToolCall {
    return { id, name, arguments: '{}' };
  }

  it('stops the loop after a terminal tool result without generating a follow-up turn', async () => {
    const collected: SessionMessage[] = [];
    let calls = 0;

    await runLoop({
      sessionId: 's1',
      projectPath: '.',
      messages: [{ id: 'u1', role: 'user', content: 'hi', createdAt: Date.now() }],
      systemPrompt: 'sys',
      tools: [terminalTool],
      maxSteps: 5,
      generate: async () => {
        calls++;
        // 第 1 轮：助手调用 terminal 工具。如果主循环正确停止，
        // 第 2 轮 generate 不应被调用。
        return { content: '调用 skill', toolCalls: [toolCall('call_a', 'skill')], finishReason: 'tool_calls' };
      },
      onMessage: (m) => collected.push(m),
      abort: new AbortController().signal,
    });

    // generate 只应被调用一次：terminal 结果后不再追加生成。
    expect(calls).toBe(1);

    // tool 结果照常持久化并与 tool_call 配对。
    const toolMsg = collected.find((m) => m.role === 'tool');
    expect(toolMsg?.toolResults?.[0]).toMatchObject({ toolCallId: 'call_a', output: 'skill 已经回答用户了' });

    // 只有一条 assistant 消息（调用 skill 那条），没有重复收尾。
    const assistantMsgs = collected.filter((m) => m.role === 'assistant');
    expect(assistantMsgs).toHaveLength(1);
  });

  it('continues the loop normally after a non-terminal tool result', async () => {
    const collected: SessionMessage[] = [];
    let calls = 0;

    await runLoop({
      sessionId: 's2',
      projectPath: '.',
      messages: [{ id: 'u1', role: 'user', content: 'hi', createdAt: Date.now() }],
      systemPrompt: 'sys',
      tools: [plainTool],
      maxSteps: 5,
      generate: async () => {
        calls++;
        if (calls === 1) {
          return { content: '调用 echo', toolCalls: [toolCall('call_a', 'echo')], finishReason: 'tool_calls' };
        }
        return { content: '收尾', toolCalls: undefined, finishReason: 'stop' };
      },
      onMessage: (m) => collected.push(m),
      abort: new AbortController().signal,
    });

    // 非 terminal 工具：第 2 轮 generate 正常产出收尾回复。
    expect(calls).toBe(2);
    const assistantMsgs = collected.filter((m) => m.role === 'assistant');
    expect(assistantMsgs).toHaveLength(2);
  });
});
