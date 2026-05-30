// Re-export barrel for backward compatibility
export type { AgentSessionSlice, AgentMessage, AgentSessionMeta } from './agentSessionSlice';
export type { AgentSkillSlice } from './agentSkillSlice';
export type { AgentDiffSlice, PendingDiff } from './agentDiffSlice';

export type AgentSlice = import('./agentSessionSlice').AgentSessionSlice &
  import('./agentSkillSlice').AgentSkillSlice &
  import('./agentDiffSlice').AgentDiffSlice;
