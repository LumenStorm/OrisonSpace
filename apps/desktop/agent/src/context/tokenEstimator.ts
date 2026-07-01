import type { SessionMessage } from '../types';

/**
 * Context window constants.
 * Fixed at 1M tokens — no per-model lookup table needed.
 */
export const CONTEXT_WINDOW = 1_000_000;
export const COMPACTION_TRIGGER_RATIO = 0.75;
export const COMPACTION_TARGET_RATIO = 0.50;

export const COMPACTION_TRIGGER_TOKENS = CONTEXT_WINDOW * COMPACTION_TRIGGER_RATIO;
export const COMPACTION_TARGET_TOKENS = CONTEXT_WINDOW * COMPACTION_TARGET_RATIO;

/**
 * Fast token estimation using character-based heuristic.
 * Mixed CJK/Latin text averages ~1 token per 3.5 characters.
 * Calibrated at runtime via actual usage feedback from the API.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

export function estimateMessagesTokens(messages: SessionMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content);
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += estimateTokens(tc.arguments) + estimateTokens(tc.name) + 10;
      }
    }
    if (msg.toolResults) {
      for (const tr of msg.toolResults) {
        total += estimateTokens(tr.output) + 10;
      }
    }
    total += 4; // per-message framing overhead
  }
  return total;
}

export function shouldTriggerCompaction(
  systemTokens: number,
  messagesTokens: number,
  calibrationRatio: number = 1.0,
): boolean {
  const estimated = (systemTokens + messagesTokens) * calibrationRatio;
  return estimated > COMPACTION_TRIGGER_TOKENS;
}

/**
 * Update calibration ratio using exponential moving average.
 * Call after each API response that includes usage.promptTokens.
 */
export function updateCalibrationRatio(
  currentRatio: number,
  actualTokens: number,
  estimatedTokens: number,
): number {
  if (estimatedTokens <= 0 || actualTokens <= 0) return currentRatio;
  const observed = actualTokens / estimatedTokens;
  return currentRatio * 0.8 + observed * 0.2;
}
