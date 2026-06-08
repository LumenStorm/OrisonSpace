import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { SkillInfo } from './types';
import { loadSkillFromDir } from './loadSkillFromDir';

export async function discoverSkills(skillsDir: string): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryDir = path.join(skillsDir, entry.name);
      const outcome = await loadSkillFromDir(entryDir);
      if (outcome.kind !== 'loaded') continue;
      const { skill } = outcome;
      skills.push({
        name: skill.name,
        description: skill.description,
        location: skill.location,
        content: skill.prompt,
        priority: skill.priority,
      });
    }
  } catch {
    // skills dir doesn't exist
  }

  return skills;
}
