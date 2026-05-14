import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface RuntimeConfig {
  externalSkillRoots: string[];
}

interface RuntimeConfigFile {
  externalSkillRoots?: string[];
}

export async function loadRuntimeConfig(projectPath: string): Promise<RuntimeConfig> {
  const envRoots = parseExternalSkillRoots(process.env.ORISON_AGENT_EXTERNAL_SKILL_ROOTS);
  const fileRoots = await loadProjectRuntimeConfig(projectPath);

  return {
    externalSkillRoots: [...envRoots, ...fileRoots],
  };
}

async function loadProjectRuntimeConfig(projectPath: string): Promise<string[]> {
  const configPath = path.join(projectPath, '.orison', 'agent.runtime.json');
  try {
    const raw = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as RuntimeConfigFile;
    return parsed.externalSkillRoots ?? [];
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
