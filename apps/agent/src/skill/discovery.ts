import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SkillInfo } from './types';
import { parseSkillFile } from './loader';

export async function discoverSkills(skillsDir: string): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
      try {
        const content = await readFile(skillMd, 'utf-8');
        const parsed = parseSkillFile(content, skillMd);
        if (parsed) skills.push(parsed);
      } catch {
        // skip skills without SKILL.md
      }
    }
  } catch {
    // skills dir doesn't exist
  }

  return skills;
}
