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

const FALLBACK_MIDDLE_COMPRESS_PROMPT = `Compress the following conversation fragment into a concise bullet-point summary. Preserve: user instructions, decisions made, files modified, and current task state. Discard: raw tool output, verbose content. Be extremely concise — output no more than 20 bullet points.`;

const FALLBACK_BUDGET_RATIO = 0.15;
const FALLBACK_MAX_TOKENS = Math.floor(COMPACTION_TARGET_TOKENS * FALLBACK_BUDGET_RATIO);
const FALLBACK_MAX_CHARS = Math.floor(FALLBACK_MAX_TOKENS * 3.5);
const PER_MESSAGE_CHAR_LIMIT = 150;
const MAX_SUMMARY_CHARS = Math.floor(COMPACTION_TARGET_TOKENS * 3.5 * 0.3);

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
    if (summary.length > MAX_SUMMARY_CHARS) {
      summary = summary.slice(0, MAX_SUMMARY_CHARS) + '\n[... summary truncated to fit budget]';
    }
  } catch (err) {
    logger.error({ err }, 'summarization failed, falling back to segmented compaction');
    summary = await segmentedFallbackSummary(toCompress, existingSummary, generate, abort);
  }

  const beforeTokens = estimateMessagesTokens(toCompress);
  const afterTokens = estimateTokens(summary);
  const savedTokens = Math.max(0, beforeTokens - afterTokens);

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
 * Segmented fallback: split messages into head / middle / tail.
 * Head and tail are kept as sanitized one-liners.
 * Middle is compressed via a lightweight subagent call; if that also fails,
 * middle is hard-truncated with head/tail preservation.
 */
async function segmentedFallbackSummary(
  messages: SessionMessage[],
  existingSummary: string | undefined,
  generate: SummarizationGenerateFn,
  abort: AbortSignal,
): Promise<string> {
  const headCount = Math.max(2, Math.floor(messages.length * 0.15));
  const tailCount = Math.max(2, Math.floor(messages.length * 0.25));
  const headMessages = messages.slice(0, headCount);
  const tailMessages = messages.slice(-tailCount);
  const middleMessages = messages.slice(headCount, messages.length - tailCount);

  const headLines = sanitizeMessages(headMessages);
  const tailLines = sanitizeMessages(tailMessages);

  let middleSummary: string;
  if (middleMessages.length === 0) {
    middleSummary = '';
  } else {
    middleSummary = await compressMiddleSegment(middleMessages, generate, abort);
  }

  const parts: string[] = [];

  if (existingSummary) {
    const trimmedExisting = existingSummary.length > FALLBACK_MAX_CHARS
      ? existingSummary.slice(0, FALLBACK_MAX_CHARS) + '\n[... prior summary truncated]'
      : existingSummary;
    parts.push(trimmedExisting);
  }

  if (headLines) parts.push(`[Early context]\n${headLines}`);
  if (middleSummary) parts.push(`[Middle context — compressed]\n${middleSummary}`);
  if (tailLines) parts.push(`[Recent context]\n${tailLines}`);

  let result = parts.join('\n\n');
  if (result.length > FALLBACK_MAX_CHARS * 2) {
    result = result.slice(0, FALLBACK_MAX_CHARS * 2) + '\n[... fallback truncated]';
  }
  return result;
}

/**
 * Attempt to compress the middle segment via a lightweight LLM call.
 * On failure, fall back to hard truncation.
 */
async function compressMiddleSegment(
  messages: SessionMessage[],
  generate: SummarizationGenerateFn,
  abort: AbortSignal,
): Promise<string> {
  const serialized = sanitizeMessages(messages);
  const request: SessionMessage[] = [{
    id: 'middle-compress',
    role: 'user',
    content: serialized,
    createdAt: Date.now(),
  }];

  try {
    const result = await generate(request, FALLBACK_MIDDLE_COMPRESS_PROMPT, abort);
    const compressed = result.content;
    const budget = Math.floor(FALLBACK_MAX_CHARS * 0.5);
    if (compressed.length > budget) {
      return compressed.slice(0, budget) + '\n[... middle summary truncated]';
    }
    return compressed;
  } catch (err) {
    logger.warn({ err, messageCount: messages.length }, 'middle segment compression also failed, hard truncating');
    const budget = Math.floor(FALLBACK_MAX_CHARS * 0.4);
    if (serialized.length > budget) {
      const head = serialized.slice(0, Math.floor(budget * 0.4));
      const tail = serialized.slice(-Math.floor(budget * 0.5));
      return `${head}\n[... ${messages.length} messages truncated ...]\n${tail}`;
    }
    return serialized;
  }
}

/**
 * Sanitize messages into a safe one-line-per-message format.
 * Uses [ROLE] bracket notation to avoid model confusion with conversation structure.
 */
function sanitizeMessages(messages: SessionMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    const role = msg.role.toUpperCase();
    let content: string;

    if (msg.role === 'tool' && msg.toolResults?.length) {
      const toolNames = msg.toolResults.map(tr => tr.toolName).join(', ');
      content = `called ${toolNames}`;
    } else if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const toolNames = msg.toolCalls.map(tc => tc.name).join(', ');
      const text = (msg.content ?? '').slice(0, PER_MESSAGE_CHAR_LIMIT).replace(/\n/g, ' ');
      content = text ? `${text} [tools: ${toolNames}]` : `[tools: ${toolNames}]`;
    } else {
      content = (msg.content ?? '').slice(0, PER_MESSAGE_CHAR_LIMIT).replace(/\n/g, ' ');
    }

    lines.push(`[${role}] ${content}`);
  }
  return lines.join('\n');
}
