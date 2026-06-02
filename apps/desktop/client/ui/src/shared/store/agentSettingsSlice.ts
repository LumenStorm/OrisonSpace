import type { StateCreator } from 'zustand';
import type { SkillPackageInfo } from '@orison/shared-contracts';

const api = window.orisonDesktop;

export type AgentSettingsSlice = {
  skillPackages: SkillPackageInfo[];
  skillPackagesLoading: boolean;
  loadSkillPackages: () => Promise<void>;
  toggleSkillPackage: (name: string, enabled: boolean) => Promise<void>;
  toggleSkill: (pkg: string, skill: string, enabled: boolean) => Promise<void>;
};

export const createAgentSettingsSlice: StateCreator<
  AgentSettingsSlice & { currentProject: { path?: string } | null },
  [], [], AgentSettingsSlice
> = (set, get) => ({
  skillPackages: [],
  skillPackagesLoading: false,

  async loadSkillPackages() {
    set({ skillPackagesLoading: true });
    try {
      const projectPath = get().currentProject?.path;
      const packages = await api.listSkillPackages(projectPath);
      set({ skillPackages: packages, skillPackagesLoading: false });
    } catch {
      set({ skillPackagesLoading: false });
    }
  },

  async toggleSkillPackage(name, enabled) {
    await api.setPackageEnabled(name, enabled);
    set((s) => ({
      skillPackages: s.skillPackages.map((p) =>
        p.name === name ? { ...p, enabled } : p
      ),
    }));
  },

  async toggleSkill(pkg, skill, enabled) {
    await api.setSkillEnabled(pkg, skill, enabled);
    set((s) => ({
      skillPackages: s.skillPackages.map((p) =>
        p.name === pkg
          ? { ...p, skills: p.skills.map((sk) => sk.name === skill ? { ...sk, enabled } : sk) }
          : p
      ),
    }));
  },
});
