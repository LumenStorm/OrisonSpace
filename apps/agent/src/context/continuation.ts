import type { CompactedConversation } from './compaction';

export interface ContinuationSnapshot {
  sessionId: string;
  compacted: CompactedConversation;
  workflowState: {
    activeSkill?: string;
    checkpoints: string[];
  };
}

export function createContinuationSnapshot(input: ContinuationSnapshot): ContinuationSnapshot {
  return input;
}

export function restoreContinuationSnapshot(snapshot: ContinuationSnapshot): {
  sessionId: string;
  summary: string;
  tail: CompactedConversation['tail'];
  workflowState: ContinuationSnapshot['workflowState'];
} {
  return {
    sessionId: snapshot.sessionId,
    summary: snapshot.compacted.summary,
    tail: snapshot.compacted.tail,
    workflowState: snapshot.workflowState,
  };
}
