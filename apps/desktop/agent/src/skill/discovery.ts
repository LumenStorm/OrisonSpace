import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SkillInfo } from './types';
import { parseSkillFile } from './loader';
import { loadDirectorySkill } from './runtime/directoryAdapter';
import { loadManifestSkill } from './runtime/manifestAdapter';

export async function discoverSkills(skillsDir: string): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryDir = path.join(skillsDir, entry.name);
      const skillMd = path.join(entryDir, 'SKILL.md');
      const manifestPath = path.join(entryDir, 'skill.json');
      try {
        const normalized = await loadDirectorySkill(entryDir);
        skills.push({
          name: normalized.name,
          description: normalized.description,
          location: normalized.location,
          content: normalized.prompt,
          priority: normalized.priority,
        });
        continue;
      } catch {
        // Fall through to manifest support.
      }

      try {
        const normalized = await loadManifestSkill(manifestPath);
        skills.push({
          name: normalized.name,
          description: normalized.description,
          location: normalized.location,
          content: normalized.prompt,
          priority: normalized.priority,
        });
        continue;
      } catch {
        // Fall through to legacy SKILL.md parsing for partial dirs.
      }

      try {
        const content = await readFile(skillMd, 'utf-8');
        const parsed = parseSkillFile(content, skillMd);
        if (parsed) skills.push(parsed);
      } catch {
        // skip skills without supported entry files
      }
    }
  } catch {
    // skills dir doesn't exist
  }

  return skills;
}
