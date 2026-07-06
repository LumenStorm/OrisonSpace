import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('skill catalog visibility', () => {
  let projectPath = '';
  let homePath = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-catalog-'));
    homePath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-home-'));
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return {
        ...actual,
        default: {
          ...actual.default,
          homedir: () => homePath,
        },
        homedir: () => homePath,
      };
    });
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(homePath, { recursive: true, force: true });
    vi.resetModules();
  });

  it('hides disabled individual skills from listing and execution catalog', async () => {
    const pkg = path.join(projectPath, '.orison', 'story-tools');
    const root = path.join(pkg, 'skills');
    const enabledSkill = path.join(root, 'enabled-skill');
    const disabledSkill = path.join(root, 'disabled-skill');
    mkdirSync(enabledSkill, { recursive: true });
    mkdirSync(disabledSkill, { recursive: true });

    writeFileSync(path.join(enabledSkill, 'SKILL.md'), [
      '---',
      'name: enabled-skill',
      'description: Enabled skill visible to the agent',
      '---',
      'Enabled body.',
    ].join('\n'), 'utf-8');
    writeFileSync(path.join(disabledSkill, 'SKILL.md'), [
      '---',
      'name: disabled-skill',
      'description: Disabled skill hidden from the agent',
      '---',
      'Disabled body.',
    ].join('\n'), 'utf-8');

    mkdirSync(path.join(homePath, '.orison'), { recursive: true });
    writeFileSync(path.join(homePath, '.orison', 'skills.json'), JSON.stringify({
      packages: {
        'story-tools': {
          enabled: true,
          disabledSkills: ['disabled-skill'],
        },
      },
    }, null, 2), 'utf-8');

    const { buildSkillCatalog } = await import('../src/skill/catalog');
    const catalog = await buildSkillCatalog(projectPath);
    const names = catalog.skills.map((skill) => skill.name);

    expect(names).toContain('enabled-skill');
    expect(names).not.toContain('disabled-skill');
    expect(catalog.byName.has('enabled-skill')).toBe(true);
    expect(catalog.byName.has('disabled-skill')).toBe(false);
  });
});
