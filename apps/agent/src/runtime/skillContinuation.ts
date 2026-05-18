import type { CompactedConversation } from '../context/compaction';
import type { SkillRunState, SerializedSkillRunState } from './skillRunState';
import { serializeSkillRunState, restoreSkillRunState } from './skillRunState';

export interface SkillContinuationPayload {
  skillRunState?: SerializedSkillRunState;
}

export function createSkillContinuation(skillRunState?: SkillRunState): SkillContinuationPayload | undefined {
  const serialized = serializeSkillRunState(skillRunState);
  if (!serialized) return undefined;
  return {
    skillRunState: serialized,
  };
}

export function restoreSkillContinuation(payload?: SkillContinuationPayload): SkillRunState | undefined {
  return restoreSkillRunState(payload?.skillRunState);
}

export function mergeConversationSummaryWithRunState(
  compacted: CompactedConversation,
  skillRunState?: SkillRunState,
): string {
  if (!skillRunState) return compacted.summary;
  const parts = [compacted.summary.trim()].filter(Boolean);
  if (skillRunState.skill) {
    parts.push(`Resumable skill: ${skillRunState.skill}`);
  }
  if (skillRunState.currentNodeId) {
    parts.push(`Current node: ${skillRunState.currentNodeId}`);
  }
  if (skillRunState.completedNodeIds.length > 0) {
    parts.push(`Completed nodes: ${skillRunState.completedNodeIds.join(', ')}`);
  }
  if (skillRunState.pendingUserAction) {
    parts.push(`Pending user action: ${skillRunState.pendingUserAction.type}`);
  }
  return parts.join('\n');
}
