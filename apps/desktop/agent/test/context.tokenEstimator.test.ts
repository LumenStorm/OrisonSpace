import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateMessagesTokens,
  shouldTriggerCompaction,
  updateCalibrationRatio,
  CONTEXT_WINDOW,
  COMPACTION_TRIGGER_RATIO,
} from '../src/context/tokenEstimator';
import type { SessionMessage } from '../src/types';

describe('tokenEstimator', () => {
  it('estimates tokens for English text', () => {
    const text = 'Hello world, this is a test.';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(text.length / 3.5));
  });

  it('estimates tokens for Chinese text', () => {
    const text = '这是一段中文测试文本，用于验证token估算的准确性。';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates message tokens including tool calls', () => {
    const messages: SessionMessage[] = [
      { id: '1', role: 'user', content: 'Read the file', createdAt: 1 },
      {
        id: '2',
        role: 'assistant',
        content: 'I will read it.',
        toolCalls: [{ id: 'tc1', name: 'read_file', arguments: '{"path":"src/index.ts"}' }],
        createdAt: 2,
      },
      {
        id: '3',
        role: 'tool',
        content: '',
        toolResults: [{ toolCallId: 'tc1', toolName: 'read_file', output: 'const x = 1;' }],
        createdAt: 3,
      },
    ];
    const tokens = estimateMessagesTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('triggers compaction when over threshold', () => {
    const systemTokens = 1000;
    const messagesTokens = CONTEXT_WINDOW * COMPACTION_TRIGGER_RATIO; // exactly at threshold
    expect(shouldTriggerCompaction(systemTokens, messagesTokens)).toBe(true);
  });

  it('does not trigger compaction when under threshold', () => {
    const systemTokens = 1000;
    const messagesTokens = 100_000;
    expect(shouldTriggerCompaction(systemTokens, messagesTokens)).toBe(false);
  });

  it('respects calibration ratio', () => {
    const systemTokens = 1000;
    const messagesTokens = 500_000;
    // With ratio 1.0, total = 501,000 < 750,000 → no trigger
    expect(shouldTriggerCompaction(systemTokens, messagesTokens, 1.0)).toBe(false);
    // With ratio 1.6, total = 801,600 > 750,000 → trigger
    expect(shouldTriggerCompaction(systemTokens, messagesTokens, 1.6)).toBe(true);
  });

  it('updates calibration ratio with EMA', () => {
    const ratio = updateCalibrationRatio(1.0, 1000, 800);
    // observed = 1000/800 = 1.25
    // new = 1.0 * 0.8 + 1.25 * 0.2 = 0.8 + 0.25 = 1.05
    expect(ratio).toBeCloseTo(1.05, 5);
  });

  it('ignores invalid values in calibration', () => {
    expect(updateCalibrationRatio(1.0, 0, 800)).toBe(1.0);
    expect(updateCalibrationRatio(1.0, 1000, 0)).toBe(1.0);
    expect(updateCalibrationRatio(1.0, -1, 100)).toBe(1.0);
  });
});
