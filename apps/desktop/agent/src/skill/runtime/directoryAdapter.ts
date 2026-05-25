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
    references: await collectFiles(path.join(skillDir, 'references')),
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
