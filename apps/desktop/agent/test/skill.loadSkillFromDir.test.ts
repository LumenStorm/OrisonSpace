import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('loadSkillFromDir', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'orison-load-skill-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.resetModules();
  });

  it('loads a standard directory skill', async () => {
    const dir = path.join(root, 'my-skill');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'SKILL.md'), `---
name: my-skill
description: A skill
---

Do the thing.
`, 'utf-8');

    const { loadSkillFromDir } = await import('../src/skill/loadSkillFromDir');
    const outcome = await loadSkillFromDir(dir, 'external');
    expect(outcome.kind).toBe('loaded');
    if (outcome.kind === 'loaded') {
      expect(outcome.skill.name).toBe('my-skill');
      expect(outcome.skill.source).toBe('external');
    }
  });

  it('loads a manifest skill when no SKILL.md is present', async () => {
    const dir = path.join(root, 'manifest-skill');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'skill.json'), JSON.stringify({
      name: 'manifest-skill',
      description: 'Manifest',
      prompt: 'Run it.',
      workflowMode: 'inline',
    }), 'utf-8');

    const { loadSkillFromDir } = await import('../src/skill/loadSkillFromDir');
    const outcome = await loadSkillFromDir(dir);
    expect(outcome.kind).toBe('loaded');
    if (outcome.kind === 'loaded') expect(outcome.skill.name).toBe('manifest-skill');
  });

  it('loads authored story skills without adapter blocking', async () => {
    const dir = path.join(root, 'story-setup');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'SKILL.md'), `---
name: story-setup
description: authored setup skill
---

setup.
`, 'utf-8');

    const { loadSkillFromDir } = await import('../src/skill/loadSkillFromDir');
    const outcome = await loadSkillFromDir(dir);
    expect(outcome.kind).toBe('loaded');
    if (outcome.kind === 'loaded') {
      expect(outcome.skill.name).toBe('story-setup');
      expect(outcome.skill.description).toBe('authored setup skill');
    }
  });

  it('returns skipped for a directory with no recognizable entry', async () => {
    const dir = path.join(root, 'empty');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'readme.txt'), 'nothing here', 'utf-8');

    const { loadSkillFromDir } = await import('../src/skill/loadSkillFromDir');
    const outcome = await loadSkillFromDir(dir);
    expect(outcome.kind).toBe('skipped');
  });
});
