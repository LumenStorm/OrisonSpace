import type { SessionMessage } from '../types';
import type { PinnedContextItem } from './pinnedContext';
import type { SummarizationGenerateFn, CompactionResult } from './summarizer';
import { estimateTokens, estimateMessagesTokens, shouldTriggerCompaction, COMPACTION_TARGET_TOKENS } from './tokenEstimator';
import { renderPinnedContext, estimatePinnedTokens } from './pinnedContext';
import { compactWithSummarization } from './summarizer';
import { logger } from '../logger';

export interface ContextState {
  compactedSummary?: string;
  compactionCount: number;
  lastCompactionAt?: number;
  totalCompactedMessages: number;
  tokenCalibrationRatio: number;
}

export function createDefaultContextState(): ContextState {
  return {
    compactionCount: 0,
    totalCompactedMessages: 0,
    tokenCalibrationRatio: 1.0,
  };
}

export interface ContextManagerInput {
  systemPrompt: string;
  messages: SessionMessage[];
  contextState: ContextState;
  pinnedContext?: PinnedContextItem[];
  generate: SummarizationGenerateFn;
  abort: AbortSignal;
}

export interface PreparedContext {
  messages: SessionMessage[];
  contextState: ContextState;
  compactionOccurred: boolean;
  compactedCount: number;
  cacheConfig: CacheConfig;
}

export interface CacheConfig {
  enablePromptCache: boolean;
  pinnedContent?: string;
  compactedSummary?: string;
}

/**
 * Main entry point: checks token budget, triggers compaction if needed,
 * and assembles the cache configuration for the provider layer.
 */
export async function prepareContext(input: ContextManagerInput): Promise<PreparedContext> {
  const { systemPrompt, messages, contextState, pinnedContext, generate, abort } = input;

  const systemTokens = estimateTokens(systemPrompt);
  const pinnedTokens = estimatePinnedTokens(pinnedContext ?? []);
  const summaryTokens = estimateTokens(contextState.compactedSummary ?? '');
  const messagesTokens = estimateMessagesTokens(messages);
  const totalTokens = systemTokens + pinnedTokens + summaryTokens + messagesTokens;

  const pinnedContent = renderPinnedContext(pinnedContext ?? []);

  let finalMessages = messages;
  let finalState = contextState;
  let compactionOccurred = false;
  let compactedCount = 0;

  if (shouldTriggerCompaction(systemTokens + pinnedTokens + summaryTokens, messagesTokens, contextState.tokenCalibrationRatio)) {
    logger.info(
      { totalTokens, messagesCount: messages.length, calibration: contextState.tokenCalibrationRatio },
      'context budget exceeded, triggering compaction',
    );

    let result: CompactionResult;
    try {
      result = await compactWithSummarization(messages, {
        targetTokens: COMPACTION_TARGET_TOKENS - systemTokens - pinnedTokens,
        preserveRecent: 6,
        pinnedContext,
        existingSummary: contextState.compactedSummary,
        generate,
        abort,
      });
    } catch (err) {
      // Re-throw abort errors — they are not compaction failures
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      logger.error({ err }, 'compaction failed, proceeding with full context');
      return {
        messages,
        contextState,
        compactionOccurred: false,
        compactedCount: 0,
        cacheConfig: {
          enablePromptCache: true,
          pinnedContent: pinnedContent || undefined,
          compactedSummary: contextState.compactedSummary,
        },
      };
    }

    finalMessages = result.retainedMessages;
    finalState = {
      compactedSummary: result.summary,
      compactionCount: contextState.compactionCount + 1,
      lastCompactionAt: Date.now(),
      totalCompactedMessages: contextState.totalCompactedMessages + result.compactedCount,
      tokenCalibrationRatio: contextState.tokenCalibrationRatio,
    };
    compactionOccurred = true;
    compactedCount = result.compactedCount;

    logger.info(
      { savedTokens: result.estimatedSavedTokens, compactedCount: result.compactedCount, retained: finalMessages.length },
      'compaction complete',
    );
  }

  return {
    messages: finalMessages,
    contextState: finalState,
    compactionOccurred,
    compactedCount,
    cacheConfig: {
      enablePromptCache: true,
      pinnedContent: pinnedContent || undefined,
      compactedSummary: finalState.compactedSummary,
    },
  };
}
