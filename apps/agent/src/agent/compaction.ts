import type { SessionMessage } from '../types';
import { logger } from '../logger';

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
  const tailCount = 4;
  const preserved = messages.slice(-tailCount);
  const toSummarize = messages.slice(0, -tailCount);

  const text = toSummarize
    .map(m => `[${m.role}]: ${m.content}`)
    .join('\n\n');

  const summary = await summarize(text);
  logger.info({ originalCount: messages.length, preservedCount: preserved.length }, 'compacted session');

  return { summary, preservedMessages: preserved };
}
