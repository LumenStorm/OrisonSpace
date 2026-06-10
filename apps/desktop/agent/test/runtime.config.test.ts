import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 把 os.homedir() 指到临时目录，避免读到开发机真实的 ~/.orison/
const homeRef = vi.hoisted(() => ({ dir: '' }));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  const homedir = () => homeRef.dir || actual.homedir();
  return {
    ...actual,
    homedir,
    default: { ...actual, homedir },
  };
});

describe('runtime config loader', () => {
  let projectPath = '';

  beforeEach(() => {
    homeRef.dir = mkdtempSync(path.join(os.tmpdir(), 'orison-runtime-config-home-'));
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-runtime-config-'));
    mkdirSync(path.join(projectPath, '.orison'), { recursive: true });
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(homeRef.dir, { recursive: true, force: true });
    homeRef.dir = '';
    vi.resetModules();
  });

  it('collects global packages from ~/.orison/skills, preferring the skills/ subdir', async () => {
    const pkgWithSubdir = path.join(homeRef.dir, '.orison', 'skills', 'pkg-a');
    mkdirSync(path.join(pkgWithSubdir, 'skills'), { recursive: true });
    const pkgFlat = path.join(homeRef.dir, '.orison', 'skills', 'pkg-b');
    mkdirSync(pkgFlat, { recursive: true });

    const { loadRuntimeConfig } = await import('../src/runtime/config');
    const config = await loadRuntimeConfig(projectPath);

    expect(config.externalSkillRoots).toContain(path.join(pkgWithSubdir, 'skills'));
    expect(config.externalSkillRoots).toContain(pkgFlat);
  });

  it('collects project-local packages from .orison/ and skips reserved dirs', async () => {
    const localPkg = path.join(projectPath, '.orison', 'team-skills');
    mkdirSync(localPkg, { recursive: true });
    mkdirSync(path.join(projectPath, '.orison', 'sessions'), { recursive: true });
    mkdirSync(path.join(projectPath, '.orison', 'artifacts'), { recursive: true });
    mkdirSync(path.join(projectPath, '.orison', 'config'), { recursive: true });

    const { loadRuntimeConfig } = await import('../src/runtime/config');
    const config = await loadRuntimeConfig(projectPath);

    expect(config.externalSkillRoots).toContain(localPkg);
    expect(config.externalSkillRoots).toHaveLength(1);
  });

  it('skips packages disabled in ~/.orison/skills.json', async () => {
    const disabledPkg = path.join(homeRef.dir, '.orison', 'skills', 'disabled-pkg');
    mkdirSync(disabledPkg, { recursive: true });
    const enabledPkg = path.join(homeRef.dir, '.orison', 'skills', 'enabled-pkg');
    mkdirSync(enabledPkg, { recursive: true });
    writeFileSync(path.join(homeRef.dir, '.orison', 'skills.json'), JSON.stringify({
      packages: { 'disabled-pkg': { enabled: false } },
    }, null, 2), 'utf-8');

    const { loadRuntimeConfig } = await import('../src/runtime/config');
    const config = await loadRuntimeConfig(projectPath);

    expect(config.externalSkillRoots).not.toContain(disabledPkg);
    expect(config.externalSkillRoots).toContain(enabledPkg);
  });
});
