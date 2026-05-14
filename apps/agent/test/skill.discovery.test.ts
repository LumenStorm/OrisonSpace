import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('skill discovery', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-discovery-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.resetModules();
  });

  it('discovers both directory and manifest skills from one root', async () => {
    const skillsDir = path.join(root, 'skills');
    const directorySkillDir = path.join(skillsDir, 'story-setup');
    const manifestSkillDir = path.join(skillsDir, 'scene-expander');
    mkdirSync(directorySkillDir, { recursive: true });
    mkdirSync(manifestSkillDir, { recursive: true });

    writeFileSync(path.join(directorySkillDir, 'SKILL.md'), `---
name: story-setup
description: Prepare project context
---

Prepare the context for a long-form writing run.
`, 'utf-8');

    writeFileSync(path.join(manifestSkillDir, 'skill.json'), JSON.stringify({
      name: 'scene-expander',
      description: 'Expand scenes',
      prompt: 'Expand the scenes.',
      workflowMode: 'inline',
    }, null, 2), 'utf-8');

    const { discoverSkills } = await import('../src/skill/discovery');
    const skills = await discoverSkills(skillsDir);

    expect(skills.map((skill) => skill.name).sort()).toEqual(['scene-expander', 'story-setup']);
  });
});
