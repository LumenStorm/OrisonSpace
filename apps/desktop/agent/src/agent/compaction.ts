import type { SessionMessage } from '../types';
import { logger } from '../logger';
import { compactConversation } from '../context/compaction';

const COMPACTION_THRESHOLD = 100_000; // chars as rough proxy for tokens

export function shouldCompact(messages: SessionMessage[]): boolean {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return totalChars > COMPACTION_THRESHOLD;
}

export interface CompactionResult {
  summary: string;
  preservedMessages: SessionMessage[];
}

export async function compact(
  messages: SessionMessage[],
  summarize: (text: string) => Promise<string>,
): Promise<CompactionResult> {
  const compacted = compactConversation({
    sessionId: 'legacy-compaction',
    messages,
    preserveLast: 4,
  });
  const summary = compacted.summary
    ? await summarize(compacted.summary)
    : '';

  logger.info({ originalCount: messages.length, preservedCount: compacted.tail.length }, 'compacted session');

  return { summary, preservedMessages: compacted.tail };
}
