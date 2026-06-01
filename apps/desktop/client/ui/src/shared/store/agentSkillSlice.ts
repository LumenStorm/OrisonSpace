import type { StateCreator } from 'zustand';
import { listAgentSkills, type AgentSkillInfo } from '../api/agent';

export type AgentSkillSlice = {
  agentSkills: AgentSkillInfo[];
  agentSkillError: string | null;
  loadAgentSkills: () => Promise<void>;
};

type Deps = AgentSkillSlice & {
  currentProject: { path?: string } | null;
};

export const createAgentSkillSlice: StateCreator<Deps, [], [], AgentSkillSlice> = (set, get) => ({
  agentSkills: [],
  agentSkillError: null,

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
});
