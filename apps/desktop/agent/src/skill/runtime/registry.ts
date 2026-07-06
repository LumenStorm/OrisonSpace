import type { NormalizedSkill } from '../types';

export class SkillRegistry {
  private readonly skills = new Map<string, NormalizedSkill>();
  private readonly scopedSkills = new Map<string, Map<string, NormalizedSkill>>();
  private readonly scopedManagedNames = new Map<string, Set<string>>();

  register(skill: NormalizedSkill, scope?: string): void {
    this.mapForScope(scope).set(skill.name, skill);
  }

  registerMany(skills: NormalizedSkill[], scope?: string): void {
    for (const skill of skills) {
      this.register(skill, scope);
    }
  }

  replaceAll(skills: NormalizedSkill[], scope?: string): void {
    const next = new Map(skills.map((skill) => [skill.name, skill]));
    if (!scope) {
      this.skills.clear();
      for (const [name, skill] of next) {
        this.skills.set(name, skill);
      }
      return;
    }
    const managedNames = this.scopedManagedNames.get(scope) ?? new Set<string>();
    for (const name of next.keys()) {
      managedNames.add(name);
    }
    this.scopedManagedNames.set(scope, managedNames);
    this.scopedSkills.set(scope, next);
  }

  list(scope?: string): NormalizedSkill[] {
    if (!scope) {
      return [...this.skills.values()];
    }
    const managedNames = this.scopedManagedNames.get(scope) ?? new Set<string>();
    const scoped = this.scopedSkills.get(scope) ?? new Map<string, NormalizedSkill>();
    const merged = new Map(
      [...this.skills].filter(([name]) => !managedNames.has(name) || scoped.has(name)),
    );
    for (const [name, skill] of scoped) {
      if (!merged.has(name)) {
        merged.set(name, skill);
      }
    }
    return [...merged.values()];
  }

  get(name: string, scope?: string): NormalizedSkill | undefined {
    if (scope) {
      const scoped = this.scopedSkills.get(scope);
      const skill = scoped?.get(name);
      const defaultSkill = this.skills.get(name);
      if (skill) return defaultSkill ?? skill;
      if (this.scopedManagedNames.get(scope)?.has(name)) return undefined;
      return defaultSkill;
    }
    return this.skills.get(name);
  }

  resolveByTrigger(trigger: string, scope?: string): NormalizedSkill | undefined {
    return this.get(trigger, scope);
  }

  has(name: string, scope?: string): boolean {
    return this.get(name, scope) !== undefined;
  }

  private mapForScope(scope?: string): Map<string, NormalizedSkill> {
    if (!scope) {
      return this.skills;
    }
    const existing = this.scopedSkills.get(scope);
    if (existing) {
      return existing;
    }
    const created = new Map<string, NormalizedSkill>();
    this.scopedSkills.set(scope, created);
    return created;
  }
}
