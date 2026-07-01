import { describe, it, expect, vi } from 'vitest';
import { prepareContext, createDefaultContextState } from '../src/context/contextManager';
import { CONTEXT_WINDOW, COMPACTION_TRIGGER_RATIO } from '../src/context/tokenEstimator';
import type { SessionMessage } from '../src/types';

function makeMessages(count: number, charsPer = 200): SessionMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: (i % 2 === 0 ? 'user' : 'assistant') as SessionMessage['role'],
    content: 'x'.repeat(charsPer),
    createdAt: Date.now() + i,
  }));
}

describe('contextManager', () => {
  it('does not compact when under threshold', async () => {
    const messages = makeMessages(10);
    const mockGenerate = vi.fn();

    const result = await prepareContext({
      systemPrompt: 'You are an assistant.',
      messages,
      contextState: createDefaultContextState(),
      generate: mockGenerate,
      abort: new AbortController().signal,
    });

    expect(result.compactionOccurred).toBe(false);
    expect(result.messages).toBe(messages);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('triggers compaction when over threshold', async () => {
    // Each message ~750 chars ≈ 215 tokens. To hit 750K tokens threshold,
    // we need messages totaling ~2.625M chars. Let's fake by using calibration.
    const messages = makeMessages(20, 1000);
    const contextState = {
      ...createDefaultContextState(),
      // Force high calibration to simulate being over threshold
      tokenCalibrationRatio: 150.0,
    };

    const mockGenerate = vi.fn().mockResolvedValue({
      content: '## Summary\n- Compacted',
    });

    const result = await prepareContext({
      systemPrompt: 'System prompt',
      messages,
      contextState,
      generate: mockGenerate,
      abort: new AbortController().signal,
    });

    expect(result.compactionOccurred).toBe(true);
    expect(result.contextState.compactionCount).toBe(1);
    expect(result.contextState.compactedSummary).toContain('Summary');
    expect(result.compactedCount).toBeGreaterThan(0);
    expect(mockGenerate).toHaveBeenCalled();
  });

  it('provides cache config with pinned content', async () => {
    const messages = makeMessages(5);
    const pinnedContext = [
      { id: 'p1', type: 'character' as const, label: 'Hero', content: 'A brave knight', priority: 80, createdAt: 1 },
    ];

    const result = await prepareContext({
      systemPrompt: 'System',
      messages,
      contextState: createDefaultContextState(),
      pinnedContext,
      generate: vi.fn(),
      abort: new AbortController().signal,
    });

    expect(result.cacheConfig.enablePromptCache).toBe(true);
    expect(result.cacheConfig.pinnedContent).toContain('Hero');
    expect(result.cacheConfig.pinnedContent).toContain('brave knight');
  });

  it('includes existing summary in cacheConfig', async () => {
    const messages = makeMessages(5);
    const contextState = {
      ...createDefaultContextState(),
      compactedSummary: '## Previous conversation about writing chapter 1',
    };

    const result = await prepareContext({
      systemPrompt: 'System',
      messages,
      contextState,
      generate: vi.fn(),
      abort: new AbortController().signal,
    });

    expect(result.cacheConfig.compactedSummary).toContain('chapter 1');
  });
});
