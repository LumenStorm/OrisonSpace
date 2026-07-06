import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedSkill } from '../src/skill/types';
import type { ToolContext } from '../src/types';

describe('skill resource tools', () => {
  let root = '';
  let skillDir = '';
  let skill: NormalizedSkill;
  let ctx: ToolContext;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-resource-'));
    skillDir = path.join(root, 'brand-voice');
    mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
    mkdirSync(path.join(skillDir, 'assets'), { recursive: true });
    writeFileSync(path.join(skillDir, 'references', 'voice.md'), 'Use concrete sentences.', 'utf-8');
    writeFileSync(path.join(skillDir, 'scripts', 'check.js'), 'export {};', 'utf-8');
    writeFileSync(path.join(skillDir, 'assets', 'sample.txt'), 'asset body', 'utf-8');
    writeFileSync(path.join(root, 'secret.md'), 'do not read', 'utf-8');

    skill = {
      format: 'directory',
      name: 'brand-voice',
      description: 'Brand voice rules',
      location: skillDir,
      source: 'project',
      entryPath: path.join(skillDir, 'SKILL.md'),
      prompt: 'Read references only when needed.',
      workflowMode: 'prompt',
      assets: {
        references: [path.join(skillDir, 'references', 'voice.md')],
        scripts: [path.join(skillDir, 'scripts', 'check.js')],
        assets: [path.join(skillDir, 'assets', 'sample.txt')],
      },
    };

    ctx = {
      sessionId: 'session-1',
      projectPath: root,
      abort: new AbortController().signal,
      skillExecutor: {
        loadSkill: vi.fn(async () => skill),
        executeSkillByName: vi.fn(),
        runSubagent: vi.fn(),
      },
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    vi.resetModules();
  });

  it('lists and reads only registered resources for a skill', async () => {
    const { skillResourceListTool, skillResourceReadTool } = await import('../src/tool/skill_resource');

    const listed = await skillResourceListTool.execute({ skill: 'brand-voice' }, ctx);
    expect(listed.output).toContain('references/voice.md');
    expect(listed.output).toContain('scripts/check.js');
    expect(listed.output).toContain('assets/sample.txt');

    const read = await skillResourceReadTool.execute({
      skill: 'brand-voice',
      path: 'references/voice.md',
    }, ctx);
    expect(read.output).toContain('Use concrete sentences.');

    await expect(skillResourceReadTool.execute({
      skill: 'brand-voice',
      path: '../secret.md',
    }, ctx)).rejects.toThrow(/registered resource/i);

    await expect(skillResourceReadTool.execute({
      skill: 'brand-voice',
      path: 'SKILL.md',
    }, ctx)).rejects.toThrow(/registered resource/i);
  });
});
