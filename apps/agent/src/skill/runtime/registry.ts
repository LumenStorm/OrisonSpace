import type { NormalizedSkill } from '../types';

export class SkillRegistry {
  private readonly skills = new Map<string, NormalizedSkill>();

  register(skill: NormalizedSkill): void {
    this.skills.set(skill.name, skill);
  }

  registerMany(skills: NormalizedSkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  list(): NormalizedSkill[] {
    return [...this.skills.values()];
  }

  get(name: string): NormalizedSkill | undefined {
    return this.skills.get(name);
  }

  resolveByTrigger(trigger: string): NormalizedSkill | undefined {
    return this.skills.get(trigger)
      ?? this.list().find((skill) => skill.name.includes(trigger) || trigger.includes(skill.name));
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }
}
