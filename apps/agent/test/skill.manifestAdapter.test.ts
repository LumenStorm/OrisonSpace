import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('skill manifest adapter', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-manifest-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.resetModules();
  });

  it('normalizes a manifest skill into the shared runtime shape', async () => {
    const skillDir = path.join(root, 'scene-expander');
    mkdirSync(skillDir, { recursive: true });

    const manifestPath = path.join(skillDir, 'skill.json');
    writeFileSync(manifestPath, JSON.stringify({
      name: 'scene-expander',
      description: 'Expand scene beats into prose guidance',
      prompt: 'Expand the provided scene beats into a richer creative brief.',
      workflowMode: 'inline',
      entry: 'prompt.txt',
      references: ['refs/scene-patterns.md'],
      scripts: ['scripts/refine.js'],
    }, null, 2), 'utf-8');

    const { loadManifestSkill } = await import('../src/skill/runtime/manifestAdapter');
    const skill = await loadManifestSkill(manifestPath);

    expect(skill).toMatchObject({
      format: 'manifest',
      name: 'scene-expander',
      description: 'Expand scene beats into prose guidance',
      workflowMode: 'inline',
      entryPath: path.join(skillDir, 'prompt.txt'),
    });
    expect(skill.assets.references).toEqual([path.join(skillDir, 'refs', 'scene-patterns.md')]);
    expect(skill.assets.scripts).toEqual([path.join(skillDir, 'scripts', 'refine.js')]);
    expect(skill.prompt).toContain('Expand the provided scene beats');
  });
});
