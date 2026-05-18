import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env';

export interface RuntimeConfig {
  externalSkillRoots: string[];
}

interface RuntimeConfigFile {
  externalSkillRoots?: string[];
}

export async function loadRuntimeConfig(projectPath: string): Promise<RuntimeConfig> {
  const envRoots = await normalizeExternalSkillRoots(
    parseExternalSkillRoots(env.ORISON_AGENT_EXTERNAL_SKILL_ROOTS),
  );
  const fileRoots = await loadProjectRuntimeConfig(projectPath);

  return {
    externalSkillRoots: dedupeRoots([...envRoots, ...fileRoots]),
  };
}

async function loadProjectRuntimeConfig(projectPath: string): Promise<string[]> {
  const configPath = path.join(projectPath, '.orison', 'agent.runtime.json');
  try {
    const raw = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as RuntimeConfigFile;
    return normalizeExternalSkillRoots(parsed.externalSkillRoots ?? []);
  } catch {
    return [];
  }
}

function parseExternalSkillRoots(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function normalizeExternalSkillRoots(roots: string[]): Promise<string[]> {
  const normalized: string[] = [];
  for (const root of roots) {
    normalized.push(await resolveSkillRoot(root));
  }
  return normalized;
}

async function resolveSkillRoot(root: string): Promise<string> {
  const trimmed = root.trim();
  if (!trimmed) return trimmed;
  const directSkillsRoot = path.join(trimmed, 'skills');
  try {
    const directStats = await stat(directSkillsRoot);
    if (directStats.isDirectory()) {
      return directSkillsRoot;
    }
  } catch {
    // Fall through to the original path.
  }
  return trimmed;
}

function dedupeRoots(roots: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const root of roots) {
    if (!root || seen.has(root)) continue;
    seen.add(root);
    deduped.push(root);
  }
  return deduped;
}
