import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseSkillFile } from '../loader';
import { normalizeSkill } from './normalize';
import { compileDirectorySkill } from './compiler';
import type { NormalizedSkill } from '../types';
import type { CompiledSkill } from './compilerTypes';

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
    workflowMode: 'workflow',
    references: await collectReferenceFiles(skillDir),
    scripts: await collectFiles(path.join(skillDir, 'scripts')),
    priority: parsed.priority,
  });

  const compiled = compileDirectorySkill({
    id: normalized.name,
    name: normalized.name,
    source: 'directory',
    entryPath: normalized.entryPath,
    location: normalized.location,
    description: normalized.description,
    rawPrompt: parsed.content,
    references: normalized.assets.references,
    scripts: normalized.assets.scripts,
    capabilities: normalized.capabilities ?? [],
    compiledPlan: normalized.compiledPlan ?? {
      entryNodeId: 'finish',
      nodes: [],
      edges: [],
    },
    warnings: [],
  } satisfies CompiledSkill);

  return {
    ...normalized,
    rawSource: parsed.content,
    capabilities: compiled.capabilities,
    compiledPlan: compiled.compiledPlan,
  };
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
