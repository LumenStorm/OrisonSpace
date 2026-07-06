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

  const normalized = normalizeSkill({
    format: 'directory',
    name: parsed.name,
    description: parsed.description,
    location: skillDir,
    entryPath,
    prompt: parsed.content,
    workflowMode: 'prompt',
    references: await collectReferenceFiles(skillDir),
    scripts: await collectFiles(path.join(skillDir, 'scripts')),
    assets: await collectFiles(path.join(skillDir, 'assets')),
    priority: parsed.priority,
    allowedTools: parsed.allowedTools,
    visibility: parsed.visibility,
    permission: parsed.permission,
  });

  return {
    ...normalized,
    rawSource: parsed.content,
    compiledPlan: undefined,
  };
}

async function collectFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await collectFiles(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    return files.sort();
  } catch {
    return [];
  }
}

// Reference material may live under any of the common directory conventions.
// Scan all of them so a skill that uses `_reference/` (e.g. oh-story) is not
// silently ignored. De-duplicate by basename, preferring the first dir found.
const REFERENCE_DIR_NAMES = ['references', 'reference', '_reference'] as const;

async function collectReferenceFiles(skillDir: string): Promise<string[]> {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const dirName of REFERENCE_DIR_NAMES) {
    const files = await collectFiles(path.join(skillDir, dirName));
    for (const file of files) {
      const base = path.basename(file);
      if (seen.has(base)) continue;
      seen.add(base);
      result.push(file);
    }
  }
  return result.sort();
}
