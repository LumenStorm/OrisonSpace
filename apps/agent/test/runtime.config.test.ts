import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime config loader', () => {
  let projectPath = '';
  let externalRoot = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-runtime-config-'));
    mkdirSync(path.join(projectPath, '.orison'), { recursive: true });
    externalRoot = mkdtempSync(path.join(os.tmpdir(), 'orison-runtime-config-external-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(externalRoot, { recursive: true, force: true });
    delete process.env.ORISON_AGENT_EXTERNAL_SKILL_ROOTS;
    vi.resetModules();
  });

  it('loads external skill roots from env and project config', async () => {
    mkdirSync(path.join(externalRoot, 'skills'), { recursive: true });
    process.env.ORISON_AGENT_EXTERNAL_SKILL_ROOTS = `${externalRoot};I:\\echo\\shared-skills`;
    writeFileSync(path.join(projectPath, '.orison', 'agent.runtime.json'), JSON.stringify({
      externalSkillRoots: ['I:\\echo\\team-skills'],
    }, null, 2), 'utf-8');

    const { loadRuntimeConfig } = await import('../src/runtime/config');
    const config = await loadRuntimeConfig(projectPath);

    expect(config.externalSkillRoots).toEqual([
      path.join(externalRoot, 'skills'),
      'I:\\echo\\shared-skills',
      'I:\\echo\\team-skills',
    ]);
  });

  it('uses the built-in oh-story external root by default', async () => {
    const { loadRuntimeConfig } = await import('../src/runtime/config');
    const config = await loadRuntimeConfig(projectPath);

    expect(config.externalSkillRoots).toContain('I:\\echo\\oh-story-claudecode-main\\skills');
  });
});
