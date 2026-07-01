import { describe, it, expect, vi } from 'vitest';
import { runLoop } from '../src/agent/loop';
import type { SessionMessage, ToolDefinition } from '../src/types';
import { CONTEXT_WINDOW } from '../src/context/tokenEstimator';

describe('loop context integration', () => {
  it('does not duplicate messages when base array is mutated by onMessage', async () => {
    // Simulate session.messages as a live reference
    const sessionMessages: SessionMessage[] = [
      { id: 'u1', role: 'user', content: 'Hello', createdAt: 1 },
    ];

    const generateCalls: SessionMessage[][] = [];
    const mockGenerate = vi.fn().mockImplementation(async (msgs: SessionMessage[]) => {
      generateCalls.push([...msgs]);
      return { content: 'Response', toolCalls: undefined, finishReason: 'stop' };
    });

    await runLoop({
      sessionId: 's1',
      projectPath: '/test',
      messages: sessionMessages, // live reference
      systemPrompt: 'System',
      tools: [],
      maxSteps: 3,
      generate: mockGenerate,
      // Simulate addMessage mutating the base array (as workflow.ts does)
      onMessage: (msg) => { sessionMessages.push(msg); },
      abort: new AbortController().signal,
    });

    // generate should only be called once (model returns stop on first call)
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    // The messages passed to generate should be exactly the snapshot (no duplicates)
    expect(generateCalls[0]).toHaveLength(1);
    expect(generateCalls[0][0].id).toBe('u1');
  });

  it('does not re-trigger compaction on subsequent steps after compaction', async () => {
    // Create a scenario where compaction is triggered on step 1 via high calibration ratio
    const messages: SessionMessage[] = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: 'x'.repeat(1000),
      createdAt: i,
    }));

    let generateCallCount = 0;
    const mockGenerate = vi.fn().mockImplementation(async (msgs: SessionMessage[], system: string, tools: any[]) => {
      generateCallCount++;
      if (tools.length === 0) {
        // This is the summarization call
        return { content: '## Summary\n- things happened', finishReason: 'stop' };
      }
      if (generateCallCount <= 4) {
        // First 2 "real" calls: return tool call then stop
        return {
          content: 'Done',
          toolCalls: undefined,
          finishReason: 'stop',
        };
      }
      return { content: 'Final', finishReason: 'stop' };
    });

    let compactionCount = 0;

    await runLoop({
      sessionId: 's1',
      projectPath: '/test',
      messages,
      systemPrompt: 'System',
      tools: [],
      maxSteps: 5,
      generate: mockGenerate,
      onMessage: () => {},
      abort: new AbortController().signal,
      contextState: {
        compactionCount: 0,
        totalCompactedMessages: 0,
        tokenCalibrationRatio: 150, // Force compaction trigger
        compactedSummary: undefined,
        lastCompactionAt: undefined,
      },
      onCompaction: () => { compactionCount++; },
      onContextStateUpdate: () => {},
    });

    // After compaction, the baseMessages should be trimmed.
    // On step 2, the calibration ratio is still 150, but the messages are now
    // just the retained tail (6 messages * 1000 chars ≈ 1714 tokens * 150 ratio
    // = ~257K tokens which is still under 750K threshold).
    // So compaction should only happen once.
    expect(compactionCount).toBe(1);
  });
});
