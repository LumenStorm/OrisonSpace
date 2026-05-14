import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseSkillFile } from '../loader';
import { normalizeSkill } from './normalize';
import type { NormalizedSkill } from '../types';

export async function loadDirectorySkill(skillDir: string): Promise<NormalizedSkill> {
  const entryPath = path.join(skillDir, 'SKILL.md');
  const raw = await readFile(entryPath, 'utf-8');
  const parsed = parseSkillFile(raw, entryPath);
  if (!parsed) {
    throw new Error(`failed to parse skill at "${entryPath}"`);
  }

  return normalizeSkill({
    format: 'directory',
    name: parsed.name,
    description: parsed.description,
    location: skillDir,
    entryPath,
    prompt: parsed.content,
    workflowMode: 'prompt',
    references: await collectFiles(path.join(skillDir, 'references')),
    scripts: await collectFiles(path.join(skillDir, 'scripts')),
  });
}

async function collectFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(dir, entry.name))
      .sort();
  } catch {
    return [];
  }
}
