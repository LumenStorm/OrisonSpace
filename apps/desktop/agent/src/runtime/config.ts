import { readFile, writeFile, stat, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const RESERVED_DIRS = new Set(['sessions', 'artifacts', 'config']);

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

function getUserOrisonDir(): string {
  return path.join(os.homedir(), '.orison');
}

function getUserSkillsDir(): string {
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

async function saveSkillsConfig(config: SkillsConfig): Promise<void> {
  const dir = getUserOrisonDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getSkillsConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

export async function loadRuntimeConfig(projectPath: string): Promise<RuntimeConfig> {
  const userSkillsDir = getUserSkillsDir();
  const config = await loadSkillsConfig();
  const roots: string[] = [];

  // 全局 ~/.orison/skills/
  try {
    const entries = await readdir(userSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgConfig = config.packages[entry.name];
      if (pkgConfig && pkgConfig.enabled === false) continue;
      roots.push(await resolveSkillRoot(path.join(userSkillsDir, entry.name)));
    }
  } catch {
    // ~/.orison/skills/ doesn't exist yet
  }

  // 项目本地 <projectPath>/.orison/
  const localOrisonDir = path.join(projectPath, '.orison');
  try {
    const entries = await readdir(localOrisonDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (RESERVED_DIRS.has(entry.name)) continue;
      const pkgConfig = config.packages[entry.name];
      if (pkgConfig && pkgConfig.enabled === false) continue;
      roots.push(await resolveSkillRoot(path.join(localOrisonDir, entry.name)));
    }
  } catch {
    // .orison/ doesn't exist in project
  }

  return { externalSkillRoots: roots };
}

async function resolveSkillRoot(pkgDir: string): Promise<string> {
  const skillsSubDir = path.join(pkgDir, 'skills');
  try {
    const s = await stat(skillsSubDir);
    if (s.isDirectory()) return skillsSubDir;
  } catch { /* no skills/ subfolder */ }
  return pkgDir;
}

export interface SkillPackageInfo {
  name: string;
  path: string;
  enabled: boolean;
  skills: Array<{ name: string; description?: string; enabled: boolean }>;
}

export async function listSkillPackages(projectPath?: string): Promise<SkillPackageInfo[]> {
  const config = await loadSkillsConfig();
  const packages: SkillPackageInfo[] = [];

  async function scanDir(dir: string, filterReserved = false) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (filterReserved && RESERVED_DIRS.has(entry.name)) continue;
        const pkgPath = path.join(dir, entry.name);
        const pkgConfig = config.packages[entry.name];
        const enabled = pkgConfig?.enabled !== false;
        const disabledSkills = pkgConfig?.disabledSkills ?? [];
        const skillRoot = await resolveSkillRoot(pkgPath);

        const skills: SkillPackageInfo['skills'] = [];
        try {
          const skillEntries = await readdir(skillRoot, { withFileTypes: true });
          for (const se of skillEntries) {
            if (!se.isDirectory()) continue;
            skills.push({
              name: se.name,
              description: await readSkillDescription(path.join(skillRoot, se.name)),
              enabled: !disabledSkills.includes(se.name),
            });
          }
        } catch { /* empty package */ }

        packages.push({ name: entry.name, path: pkgPath, enabled, skills });
      }
    } catch { /* dir doesn't exist */ }
  }

  await scanDir(getUserSkillsDir());
  if (projectPath) await scanDir(path.join(projectPath, '.orison'), true);

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
