import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('skill directory adapter', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-dir-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.resetModules();
  });

  it('normalizes a directory skill with references and scripts metadata', async () => {
    const skillDir = path.join(root, 'story-setup');
    mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });

    writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: story-setup
description: Prepare long-form story context
---

# Story Setup

Load references and collect planning inputs.
`, 'utf-8');
    writeFileSync(path.join(skillDir, 'references', 'world.md'), '# World', 'utf-8');
    writeFileSync(path.join(skillDir, 'scripts', 'bootstrap.ts'), 'export {};', 'utf-8');

    const { loadDirectorySkill } = await import('../src/skill/runtime/directoryAdapter');
    const skill = await loadDirectorySkill(skillDir);

    expect(skill).toMatchObject({
      format: 'directory',
      name: 'story-setup',
      description: 'Prepare long-form story context',
      entryPath: path.join(skillDir, 'SKILL.md'),
      workflowMode: 'prompt',
    });
    expect(skill.assets.references).toEqual([path.join(skillDir, 'references', 'world.md')]);
    expect(skill.assets.scripts).toEqual([path.join(skillDir, 'scripts', 'bootstrap.ts')]);
  });
});
