import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('skill runtime bootstrap', () => {
  let projectPath = '';
  let externalSkillsRoot = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-bootstrap-'));
    externalSkillsRoot = mkdtempSync(path.join(os.tmpdir(), 'orison-external-skills-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(externalSkillsRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('loads skills from the project skill root and executes one by name', async () => {
    const skillsDir = path.join(projectPath, '.orison', 'skills');
    const skillDir = path.join(skillsDir, 'story-setup');
    mkdirSync(skillDir, { recursive: true });

    writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime();

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const loaded = await runtime.loadSkillsForSession(session.id);
    expect(loaded).toContain('story-setup');

    const result = await runtime.executeSkillByName(session.id, 'story-setup');
    expect(result).toMatchObject({
      skill: 'story-setup',
      status: 'completed',
      outputs: ['Prepare the story context.'],
    });
  });

  it('loads skills from explicit external roots and executes one by name', async () => {
    const externalSkillDir = path.join(externalSkillsRoot, 'scene-expander');
    mkdirSync(externalSkillDir, { recursive: true });

    writeFileSync(path.join(externalSkillDir, 'skill.json'), JSON.stringify({
      name: 'scene-expander',
      description: 'Expand scenes from external pack',
      prompt: 'Expand the external scene.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const { createWorkflowRuntime } = await import('../src/runtime/workflow');
    const runtime = createWorkflowRuntime({
      externalSkillRoots: [externalSkillsRoot],
    });

    const session = runtime.createSession({
      agentName: 'writer',
      projectPath,
    });

    const loaded = await runtime.loadSkillsForSession(session.id);
    expect(loaded).toContain('scene-expander');

    const result = await runtime.executeSkillByName(session.id, 'scene-expander');
    expect(result).toMatchObject({
      skill: 'scene-expander',
      status: 'completed',
      outputs: ['Expand the external scene.'],
    });
  });
});
