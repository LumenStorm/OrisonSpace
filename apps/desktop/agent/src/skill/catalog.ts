import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadRuntimeConfig, loadSkillsConfig } from '../runtime/config';
import { loadSkillFromDir } from './loadSkillFromDir';
import type { NormalizedSkill } from './types';

export interface SkillCatalog {
  skills: NormalizedSkill[];
  byName: Map<string, NormalizedSkill>;
}

export async function buildSkillCatalog(projectPath: string, extraRoots: string[] = []): Promise<SkillCatalog> {
  const runtimeConfig = await loadRuntimeConfig(projectPath);
  const skillsConfig = await loadSkillsConfig();
  const roots = uniqueRoots([
    path.join(projectPath, '.orison', 'skills'),
    ...extraRoots,
    ...runtimeConfig.externalSkillRoots,
  ]);

  const byName = new Map<string, NormalizedSkill>();

  for (const root of roots) {
    const packageName = inferPackageName(root);
    const packageConfig = skillsConfig.packages[packageName];
    if (packageConfig?.enabled === false) continue;

    const disabledSkills = new Set(packageConfig?.disabledSkills ?? []);
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (disabledSkills.has(entry.name)) continue;

      const entryDir = path.join(root, entry.name);
      const outcome = await loadSkillFromDir(entryDir, root.startsWith(projectPath) ? 'project' : 'external');
      if (outcome.kind !== 'loaded') continue;

      const skill = outcome.skill;
      if (disabledSkills.has(skill.name)) continue;
      if (skill.visibility === 'hidden') continue;
      if (byName.has(skill.name)) continue;

      byName.set(skill.name, skill);
    }
  }

  const skills = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    skills,
    byName: new Map(skills.map((skill) => [skill.name, skill])),
  };
}

function uniqueRoots(roots: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const root of roots) {
    const normalized = path.resolve(root);
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function inferPackageName(root: string): string {
  const normalized = path.resolve(root);
  if (path.basename(normalized).toLowerCase() === 'skills') {
    return path.basename(path.dirname(normalized));
  }
  return path.basename(normalized);
}
