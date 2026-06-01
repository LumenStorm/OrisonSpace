import { readFile, writeFile, stat, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface RuntimeConfig {
  externalSkillRoots: string[];
}

export interface SkillPackageConfig {
  enabled: boolean;
  disabledSkills?: string[];
}

export interface SkillsConfig {
  packages: Record<string, SkillPackageConfig>;
}

export function getUserOrisonDir(): string {
  return path.join(os.homedir(), '.orison');
}

export function getUserSkillsDir(): string {
  return path.join(getUserOrisonDir(), 'skills');
}

function getSkillsConfigPath(): string {
  return path.join(getUserOrisonDir(), 'skills.json');
}

export async function loadSkillsConfig(): Promise<SkillsConfig> {
  try {
    const raw = await readFile(getSkillsConfigPath(), 'utf-8');
    return JSON.parse(raw) as SkillsConfig;
  } catch {
    return { packages: {} };
  }
}

export async function saveSkillsConfig(config: SkillsConfig): Promise<void> {
  const dir = getUserOrisonDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getSkillsConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

export async function loadRuntimeConfig(_projectPath: string): Promise<RuntimeConfig> {
  const userSkillsDir = getUserSkillsDir();
  const config = await loadSkillsConfig();
  const roots: string[] = [];

  try {
    const entries = await readdir(userSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgConfig = config.packages[entry.name];
      if (pkgConfig && pkgConfig.enabled === false) continue;
      roots.push(path.join(userSkillsDir, entry.name));
    }
  } catch {
    // ~/.orison/skills/ doesn't exist yet
  }

  return { externalSkillRoots: roots };
}

export interface SkillPackageInfo {
  name: string;
  path: string;
  enabled: boolean;
  skills: Array<{ name: string; description?: string; enabled: boolean }>;
}

export async function listSkillPackages(): Promise<SkillPackageInfo[]> {
  const userSkillsDir = getUserSkillsDir();
  const config = await loadSkillsConfig();
  const packages: SkillPackageInfo[] = [];

  try {
    const entries = await readdir(userSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgPath = path.join(userSkillsDir, entry.name);
      const pkgConfig = config.packages[entry.name];
      const enabled = pkgConfig?.enabled !== false;
      const disabledSkills = pkgConfig?.disabledSkills ?? [];

      const skills: SkillPackageInfo['skills'] = [];
      try {
        const skillEntries = await readdir(pkgPath, { withFileTypes: true });
        for (const se of skillEntries) {
          if (!se.isDirectory()) continue;
          skills.push({
            name: se.name,
            description: await readSkillDescription(path.join(pkgPath, se.name)),
            enabled: !disabledSkills.includes(se.name),
          });
        }
      } catch { /* empty package */ }

      packages.push({ name: entry.name, path: pkgPath, enabled, skills });
    }
  } catch {
    // ~/.orison/skills/ doesn't exist
  }

  return packages;
}

async function readSkillDescription(skillDir: string): Promise<string | undefined> {
  try {
    const manifestPath = path.join(skillDir, 'skill.json');
    const raw = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);
    return manifest.description;
  } catch {
    try {
      const mdPath = path.join(skillDir, 'SKILL.md');
      const content = await readFile(mdPath, 'utf-8');
      const match = content.match(/^description:\s*(.+)$/m);
      return match?.[1]?.trim();
    } catch {
      return undefined;
    }
  }
}

export async function setPackageEnabled(packageName: string, enabled: boolean): Promise<void> {
  const config = await loadSkillsConfig();
  if (!config.packages[packageName]) {
    config.packages[packageName] = { enabled };
  } else {
    config.packages[packageName].enabled = enabled;
  }
  await saveSkillsConfig(config);
}

export async function setSkillEnabled(packageName: string, skillName: string, enabled: boolean): Promise<void> {
  const config = await loadSkillsConfig();
  if (!config.packages[packageName]) {
    config.packages[packageName] = { enabled: true, disabledSkills: [] };
  }
  const pkg = config.packages[packageName];
  if (!pkg.disabledSkills) pkg.disabledSkills = [];

  if (enabled) {
    pkg.disabledSkills = pkg.disabledSkills.filter((s) => s !== skillName);
  } else if (!pkg.disabledSkills.includes(skillName)) {
    pkg.disabledSkills.push(skillName);
  }
  await saveSkillsConfig(config);
}
