import { describe, expect, it } from 'vitest';
import { buildStorySyncMessages } from '../src/prompt';

describe('buildStorySyncMessages', () => {
  it('returns a system message and a user message', () => {
    const messages = buildStorySyncMessages({
      runId: 'r1',
      chapterId: 'c1',
      candidate: { content: '...' },
      context: {},
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('includes the chapter candidate in the user payload', () => {
    const messages = buildStorySyncMessages({
      runId: 'r1',
      chapterId: 'c1',
      candidate: { content: '一把铜钥匙' },
      context: { chapterNumber: 7 },
    });
    expect(messages[1].content).toContain('铜钥匙');
    expect(messages[1].content).toContain('"chapterNumber": 7');
  });

  it('keeps system prompt stable so adapter snapshot tests in callers stay green', () => {
    const a = buildStorySyncMessages({ runId: 'r', chapterId: 'c', candidate: {}, context: {} });
    const b = buildStorySyncMessages({ runId: 'r', chapterId: 'c', candidate: {}, context: {} });
    expect(a[0].content).toBe(b[0].content);
  });
});
