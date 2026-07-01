import { describe, it, expect, vi } from 'vitest';
import { compactWithSummarization } from '../src/context/summarizer';
import type { SessionMessage } from '../src/types';

function makeMessages(count: number): SessionMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: (i % 2 === 0 ? 'user' : 'assistant') as SessionMessage['role'],
    content: `Message content number ${i}. `.repeat(10),
    createdAt: Date.now() + i * 1000,
  }));
}

describe('summarizer', () => {
  it('retains recent messages and compresses earlier ones', async () => {
    const messages = makeMessages(20);
    const mockGenerate = vi.fn().mockResolvedValue({
      content: '## Summary\n- User discussed 10 topics\n- Assistant provided solutions',
    });

    const result = await compactWithSummarization(messages, {
      preserveRecent: 6,
      generate: mockGenerate,
      abort: new AbortController().signal,
    });

    expect(result.retainedMessages).toHaveLength(6);
    expect(result.compactedCount).toBe(14);
    expect(result.summary).toContain('Summary');
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('returns empty result when nothing to compress', async () => {
    const messages = makeMessages(4);
    const mockGenerate = vi.fn();

    const result = await compactWithSummarization(messages, {
      preserveRecent: 6,
      generate: mockGenerate,
      abort: new AbortController().signal,
    });

    expect(result.compactedCount).toBe(0);
    expect(result.retainedMessages).toHaveLength(4);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('falls back to naive summary on generate failure', async () => {
    const messages = makeMessages(10);
    const mockGenerate = vi.fn().mockRejectedValue(new Error('API error'));

    const result = await compactWithSummarization(messages, {
      preserveRecent: 4,
      generate: mockGenerate,
      abort: new AbortController().signal,
    });

    expect(result.compactedCount).toBe(6);
    expect(result.summary).toContain('Message content');
    expect(result.retainedMessages).toHaveLength(4);
  });

  it('truncates large tool outputs in serialization', async () => {
    const messages: SessionMessage[] = [
      { id: '1', role: 'user', content: 'Read the file', createdAt: 1 },
      {
        id: '2',
        role: 'tool',
        content: '',
        toolResults: [{ toolCallId: 'tc1', toolName: 'read_file', output: 'x'.repeat(2000) }],
        createdAt: 2,
      },
      ...makeMessages(6),
    ];

    let capturedInput = '';
    const mockGenerate = vi.fn().mockImplementation(async (msgs) => {
      capturedInput = msgs[0].content;
      return { content: '## Summary\n- File was read' };
    });

    await compactWithSummarization(messages, {
      preserveRecent: 6,
      generate: mockGenerate,
      abort: new AbortController().signal,
    });

    // The 2000-char output should be truncated in what we send to summarizer
    expect(capturedInput).toContain('truncated');
    expect(capturedInput.length).toBeLessThan(2000);
  });

  it('includes existing summary as context for incremental compaction', async () => {
    const messages = makeMessages(10);
    let capturedInput = '';
    const mockGenerate = vi.fn().mockImplementation(async (msgs) => {
      capturedInput = msgs[0].content;
      return { content: '## Updated Summary\n- Previous + new context' };
    });

    await compactWithSummarization(messages, {
      preserveRecent: 4,
      existingSummary: '## Old Summary\n- Previous discussions',
      generate: mockGenerate,
      abort: new AbortController().signal,
    });

    expect(capturedInput).toContain('[Previous summary]');
    expect(capturedInput).toContain('Old Summary');
  });
});
