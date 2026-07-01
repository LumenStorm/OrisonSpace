import type { MessageRole } from '../types';

export interface CompactConversationInput {
  sessionId: string;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    createdAt: number;
  }>;
  preserveLast?: number;
}

export interface CompactedConversation {
  sessionId: string;
  summary: string;
  tail: CompactConversationInput['messages'];
}

export function compactConversation(input: CompactConversationInput): CompactedConversation {
  const preserveLast = input.preserveLast ?? 2;
  const summaryMessages = input.messages.slice(0, Math.max(0, input.messages.length - preserveLast));
  const tail = input.messages.slice(-preserveLast);

  return {
    sessionId: input.sessionId,
    summary: summaryMessages.map((message) => `${message.role}: ${message.content}`).join('\n'),
    tail,
  };
}

// Re-export the new LLM-based compaction for use in contextManager
export { compactWithSummarization } from './summarizer';
export type { CompactionResult, CompactionOptions, SummarizationGenerateFn } from './summarizer';
