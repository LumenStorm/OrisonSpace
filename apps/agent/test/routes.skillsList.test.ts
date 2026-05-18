import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAgent } from '../src/app';

describe('agent skills listing route', () => {
  let projectPath = '';
  let externalSkillsRoot = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-list-project-'));
    externalSkillsRoot = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-list-external-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(externalSkillsRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('lists merged skills from project and external skill roots', async () => {
    const projectSkillsDir = path.join(projectPath, '.orison', 'skills', 'story-setup');
    mkdirSync(projectSkillsDir, { recursive: true });
    writeFileSync(path.join(projectSkillsDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const externalSkillDir = path.join(externalSkillsRoot, 'scene-expander');
    mkdirSync(externalSkillDir, { recursive: true });
    writeFileSync(path.join(externalSkillDir, 'skill.json'), JSON.stringify({
      name: 'scene-expander',
      description: 'Expand scenes',
      prompt: 'Expand the first scene.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const app = buildAgent({
      runtime: {
        externalSkillRoots: [externalSkillsRoot],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/agent/skills?projectPath=${encodeURIComponent(projectPath)}`,
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { skills: Array<{ name: string; source?: string; capabilities?: string[] }> };
    const skillNames = payload.skills.map((skill) => skill.name);
    expect(skillNames).toContain('scene-expander');
    expect(skillNames).toContain('story-setup');
    expect(payload.skills.find((skill) => skill.name === 'story-setup')?.source).toBe('project');
    expect(payload.skills.find((skill) => skill.name === 'scene-expander')?.source).toBe('external');
    expect(payload.skills.find((skill) => skill.name === 'story-setup')?.capabilities).toEqual([]);

    await app.close();
  });

  it('shows the built-in oh-story external skills as external sources', async () => {
    const ohStoryRoot = 'I:\\echo\\oh-story-claudecode-main';
    if (!existsSync(path.join(ohStoryRoot, 'skills', 'story', 'SKILL.md'))) {
      return;
    }

    const app = buildAgent();

    const response = await app.inject({
      method: 'GET',
      url: `/v1/agent/skills?projectPath=${encodeURIComponent(projectPath)}`,
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { skills: Array<{ name: string; source?: string; capabilities?: string[] }> };
    expect(payload.skills.find((skill) => skill.name === 'story')?.source).toBe('external');
    expect(payload.skills.find((skill) => skill.name === 'story-long-write')).toMatchObject({
      source: 'external',
      capabilities: expect.arrayContaining(['load_reference', 'spawn_agent']),
    });
    expect(payload.skills.find((skill) => skill.name === 'story-review')).toMatchObject({
      source: 'external',
      capabilities: expect.arrayContaining(['load_reference', 'spawn_agent']),
    });

    await app.close();
  });
});
