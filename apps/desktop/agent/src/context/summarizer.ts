import type { SessionMessage } from '../types';
import type { PinnedContextItem } from './pinnedContext';
import { estimateTokens, estimateMessagesTokens, COMPACTION_TARGET_TOKENS } from './tokenEstimator';
import { logger } from '../logger';

export interface CompactionResult {
  summary: string;
  retainedMessages: SessionMessage[];
  compactedCount: number;
  estimatedSavedTokens: number;
}

export interface CompactionOptions {
  targetTokens?: number;
  preserveRecent?: number;
  pinnedContext?: PinnedContextItem[];
  existingSummary?: string;
  generate: SummarizationGenerateFn;
  abort: AbortSignal;
}

export type SummarizationGenerateFn = (
  messages: SessionMessage[],
  system: string,
  abort: AbortSignal,
) => Promise<{ content: string }>;

const TOOL_OUTPUT_TRUNCATE_THRESHOLD = 500;

const SUMMARIZATION_SYSTEM_PROMPT = `You are a conversation history compressor. Compress the following conversation into a structured summary.

Requirements:
1. Preserve all key decisions and conclusions
2. Preserve user's explicit instructions and preferences
3. Preserve important file modification records (which file, what changes)
4. Discard verbose tool output details (full file contents, raw search results, etc.)
5. Preserve causal relationships between errors and their fixes
6. Organize in concise bullet-point form

Output format:
## Conversation Summary
- [Key decisions/conclusions]
- [User instructions/preferences]
- [File modification records]
- [Current task state]
`;

/**
 * Compress early messages into an LLM-generated summary, retaining the most
 * recent messages intact for immediate conversational coherence.
 */
export async function compactWithSummarization(
  messages: SessionMessage[],
  options: CompactionOptions,
): Promise<CompactionResult> {
  const {
    targetTokens = COMPACTION_TARGET_TOKENS,
    preserveRecent = 6,
    existingSummary,
    generate,
    abort,
  } = options;

  let splitIndex = Math.max(0, messages.length - preserveRecent);
  // Ensure we don't split between an assistant (with toolCalls) and its tool results
  while (splitIndex > 0 && messages[splitIndex]?.role === 'tool') {
    splitIndex--;
  }
  const toCompress = messages.slice(0, splitIndex);
  const retained = messages.slice(splitIndex);

  if (toCompress.length === 0) {
    return {
      summary: existingSummary ?? '',
      retainedMessages: retained,
      compactedCount: 0,
      estimatedSavedTokens: 0,
    };
  }

  const compressedText = serializeForSummarization(toCompress, existingSummary);

  const summaryRequest: SessionMessage[] = [
    {
      id: 'summarize-request',
      role: 'user',
      content: compressedText,
      createdAt: Date.now(),
    },
  ];

  let summary: string;
  try {
    const result = await generate(summaryRequest, SUMMARIZATION_SYSTEM_PROMPT, abort);
    summary = result.content;
  } catch (err) {
    logger.error({ err }, 'summarization failed, falling back to naive compaction');
    summary = naiveFallbackSummary(toCompress, existingSummary);
  }

  const beforeTokens = estimateMessagesTokens(toCompress);
  const afterTokens = estimateTokens(summary);
  const savedTokens = Math.max(0, beforeTokens - afterTokens);

  // If we're still over target after summarization, trim the retained window
  const totalAfter = afterTokens + estimateMessagesTokens(retained);
  if (totalAfter > targetTokens && retained.length > 2) {
    logger.warn(
      { totalAfter, targetTokens },
      'post-compaction still over target; consider increasing preserveRecent trim',
    );
  }

  return {
    summary,
    retainedMessages: retained,
    compactedCount: toCompress.length,
    estimatedSavedTokens: savedTokens,
  };
}

/**
 * Serialize messages for the summarization prompt.
 * Truncates large tool outputs to keep the summarization request itself small.
 */
function serializeForSummarization(messages: SessionMessage[], existingSummary?: string): string {
  const parts: string[] = [];

  if (existingSummary) {
    parts.push(`[Previous summary]\n${existingSummary}\n`);
    parts.push('[New messages to incorporate into the summary]\n');
  }

  for (const msg of messages) {
    if (msg.role === 'tool' && msg.toolResults?.length) {
      for (const tr of msg.toolResults) {
        const truncated = tr.output.length > TOOL_OUTPUT_TRUNCATE_THRESHOLD
          ? `[${tr.toolName}] returned content (${tr.output.length} chars, truncated): ${tr.output.slice(0, TOOL_OUTPUT_TRUNCATE_THRESHOLD)}...`
          : `[${tr.toolName}]: ${tr.output}`;
        parts.push(`tool: ${truncated}`);
      }
    } else if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const toolNames = msg.toolCalls.map(tc => tc.name).join(', ');
      const textPart = msg.content ? `${msg.content}\n` : '';
      parts.push(`assistant: ${textPart}[called tools: ${toolNames}]`);
    } else {
      parts.push(`${msg.role}: ${msg.content}`);
    }
  }

  return parts.join('\n');
}

/**
 * Fallback when LLM summarization fails — plain concatenation (same as the
 * original compactConversation behavior).
 */
function naiveFallbackSummary(messages: SessionMessage[], existingSummary?: string): string {
  const lines = messages.map(m => `${m.role}: ${m.content}`);
  if (existingSummary) {
    return `${existingSummary}\n\n${lines.join('\n')}`;
  }
  return lines.join('\n');
}
