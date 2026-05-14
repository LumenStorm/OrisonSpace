import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAgent } from '../src/app';

describe('agent skill execution routes', () => {
  let projectPath = '';
  let externalSkillsRoot = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-route-project-'));
    externalSkillsRoot = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-route-external-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(externalSkillsRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('executes a skill by session and name through the HTTP route', async () => {
    const externalSkillDir = path.join(externalSkillsRoot, 'story-setup');
    mkdirSync(externalSkillDir, { recursive: true });
    writeFileSync(path.join(externalSkillDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const app = buildAgent({
      runtime: {
        externalSkillRoots: [externalSkillsRoot],
      },
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-setup/execute`,
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      skill: 'story-setup',
      status: 'completed',
      outputs: ['Prepare the story context.'],
      continuation: {
        sessionId,
        workflowState: {
          activeSkill: 'story-setup',
        },
      },
    });

    await app.close();
  });

  it('accepts artifact and reference ids for skill execution context', async () => {
    const externalSkillDir = path.join(externalSkillsRoot, 'story-setup');
    mkdirSync(externalSkillDir, { recursive: true });
    writeFileSync(path.join(externalSkillDir, 'skill.json'), JSON.stringify({
      name: 'story-setup',
      description: 'Prepare story context',
      prompt: 'Prepare the story context.',
      workflowMode: 'workflow',
      references: [],
      scripts: [],
    }, null, 2), 'utf-8');

    const app = buildAgent({
      runtime: {
        externalSkillRoots: [externalSkillsRoot],
      },
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-setup/execute`,
      payload: {
        input: 'Build a noir setup',
        artifactIds: ['outline-1'],
        referenceIds: ['ref-1'],
      },
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      skill: 'story-setup',
      status: 'completed',
      outputs: ['Prepare the story context.\n\nBuild a noir setup'],
      continuation: {
        sessionId,
        workflowState: {
          activeSkill: 'story-setup',
        },
      },
    });

    await app.close();
  });
});
