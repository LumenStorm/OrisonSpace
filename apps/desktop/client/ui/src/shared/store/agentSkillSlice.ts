import type { StateCreator } from 'zustand';
import {
  executeAgentSkill,
  listAgentContinuations,
  listAgentSkills,
  restoreAgentContinuation as restoreAgentContinuationApi,
  type AgentContinuation,
  type AgentContinuationListItem,
  type AgentContinuationRestoreState,
  type AgentMessage,
  type AgentSkillInfo,
} from '../api/agent';

export type AgentSkillSlice = {
  agentSkills: AgentSkillInfo[];
  agentSkillError: string | null;
  latestSkillContinuation: AgentContinuation | null;
  agentContinuations: AgentContinuationListItem[];
  restoredSkillContinuation: AgentContinuationRestoreState | null;
  continuationSourceSessionId: string | null;
  loadAgentSkills: () => Promise<void>;
  loadAgentContinuations: (sessionIdOverride?: string | null) => Promise<void>;
  runAgentSkill: (skillName: string) => Promise<void>;
  restoreLatestSkillContinuation: () => Promise<void>;
  rerunLatestSkillContinuation: () => Promise<void>;
  restoreAgentContinuation: (continuationId: string) => Promise<void>;
};

type Deps = AgentSkillSlice & {
  currentProject: { path?: string } | null;
  agentSessionId: string | null;
  agentMessages: AgentMessage[];
  agentLoading: boolean;
  agentError: string | null;
};

export const createAgentSkillSlice: StateCreator<Deps, [], [], AgentSkillSlice> = (set, get) => ({
  agentSkills: [],
  agentSkillError: null,
  latestSkillContinuation: null,
  agentContinuations: [],
  restoredSkillContinuation: null,
  continuationSourceSessionId: null,

  async loadAgentSkills() {
    const projectPath = get().currentProject?.path;
    if (!projectPath) {
      set({ agentSkills: [], agentSkillError: null });
      return;
    }
    try {
      const skills = await listAgentSkills(projectPath);
      set({ agentSkills: skills ?? [], agentSkillError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentSkillError: message, agentSkills: [] });
    }
  },

  async loadAgentContinuations(sessionIdOverride) {
    const sessionId = sessionIdOverride ?? get().continuationSourceSessionId ?? get().agentSessionId;
    if (!sessionId) {
      set({ agentContinuations: [] });
      return;
    }
    try {
      const list = await listAgentContinuations(sessionId);
      set({ agentContinuations: list ?? [] });
    } catch {
      set({ agentContinuations: [] });
    }
  },

  async runAgentSkill(skillName) {
    const sessionId = get().agentSessionId;
    if (!sessionId) return;
    set({ agentLoading: true, agentError: null } as any);
    try {
      const result = await executeAgentSkill(sessionId, skillName);
      if (result.continuation) {
        set({ latestSkillContinuation: result.continuation });
        const sourceId = result.continuation.sessionId ?? sessionId;
        set({ continuationSourceSessionId: sourceId });
        await get().loadAgentContinuations(sourceId);
      }
      set({ agentLoading: false } as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false } as any);
    }
  },

  async restoreLatestSkillContinuation() {
    const continuation = get().latestSkillContinuation;
    const sessionId = get().agentSessionId;
    if (!continuation || !sessionId) return;
    const continuationId = continuation.continuationId;
    if (!continuationId) return;
    set({ agentLoading: true, agentError: null } as any);
    try {
      const restored = await restoreAgentContinuationApi(sessionId, continuationId);
      const sourceSessionId = restored.sourceSessionId;
      set({
        agentSessionId: restored.sessionId,
        agentMessages: restored.tail.map((item) => ({
          id: item.id,
          role: item.role as AgentMessage['role'],
          content: item.content,
          createdAt: item.createdAt,
        })),
        restoredSkillContinuation: {
          sourceSessionId,
          sessionId: restored.sessionId,
          summary: restored.summary,
          tail: restored.tail,
          workflowState: restored.workflowState,
        },
        continuationSourceSessionId: sourceSessionId,
        agentLoading: false,
        agentError: null,
      } as any);
      await get().loadAgentContinuations(sourceSessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false } as any);
    }
  },

  async rerunLatestSkillContinuation() {
    const continuation = get().latestSkillContinuation;
    if (!continuation) return;
    const sessionId = get().agentSessionId;
    if (!sessionId) return;
    set({ agentLoading: true, agentError: null } as any);
    try {
      const skillName = continuation.workflowState?.activeSkill ?? 'unknown';
      const result = await executeAgentSkill(sessionId, skillName);
      if (result.continuation) {
        set({ latestSkillContinuation: result.continuation });
        const sourceId = result.continuation.sessionId ?? sessionId;
        set({ continuationSourceSessionId: sourceId });
        await get().loadAgentContinuations(sourceId);
      }
      set({ agentLoading: false } as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false } as any);
    }
  },

  async restoreAgentContinuation(continuationId) {
    const sessionId = get().agentSessionId;
    if (!sessionId) return;
    set({ agentLoading: true, agentError: null } as any);
    try {
      const restored = await restoreAgentContinuationApi(sessionId, continuationId);
      const sourceSessionId = restored.sourceSessionId;
      set({
        agentSessionId: restored.sessionId,
        agentMessages: restored.tail.map((item) => ({
          id: item.id,
          role: item.role as AgentMessage['role'],
          content: item.content,
          createdAt: item.createdAt,
        })),
        restoredSkillContinuation: {
          sourceSessionId,
          sessionId: restored.sessionId,
          summary: restored.summary,
          tail: restored.tail,
          workflowState: restored.workflowState,
        },
        continuationSourceSessionId: sourceSessionId,
        agentLoading: false,
        agentError: null,
      } as any);
      await get().loadAgentContinuations(sourceSessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ agentError: message, agentLoading: false } as any);
    }
  },
});
