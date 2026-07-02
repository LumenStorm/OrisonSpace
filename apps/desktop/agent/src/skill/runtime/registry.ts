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
    const exact = this.skills.get(trigger);
    if (exact) return exact;
    // Prefer skill whose name is a substring of the trigger (e.g. trigger
    // "story-long" matches skill "story-long-write" is wrong; but skill name
    // "story-long" inside trigger "story-long-write" is fine). Pick the longest
    // matching name to avoid short names acting as catch-alls.
    let best: NormalizedSkill | undefined;
    for (const skill of this.skills.values()) {
      if (trigger.includes(skill.name) || skill.name.includes(trigger)) {
        if (!best || skill.name.length > best.name.length) {
          best = skill;
        }
      }
    }
    return best;
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }
}
