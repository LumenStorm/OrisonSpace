import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAgent } from '../src/app';

describe('chat-level skill invocation protocol', () => {
  let projectPath = '';
  let externalSkillsRoot = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-chat-project-'));
    externalSkillsRoot = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-chat-external-'));
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(externalSkillsRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  it('routes @skill messages into skill execution', async () => {
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

    const messageResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/messages`,
      payload: {
        content: '@skill story-setup build a noir mystery setup',
      },
    });

    expect(messageResponse.statusCode).toBe(200);
    const payload = messageResponse.json() as { messages: Array<{ role: string; content: string }> };
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0]).toMatchObject({
      role: 'assistant',
    });
    expect(payload.messages[0]?.content).toContain('Prepare the story context.');
    expect(payload.messages[0]?.content).toContain('build a noir mystery setup');

    await app.close();
  });

  it('routes /skill messages into skill execution over stream', async () => {
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

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        projectPath,
      },
    });
    const sessionId = sessionResponse.json().id as string;

    const streamResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/stream`,
      payload: {
        content: '/skill scene-expander focus on emotional tension',
      },
    });

    expect(streamResponse.statusCode).toBe(200);
    expect(streamResponse.body).toContain('event: assistant');
    expect(streamResponse.body).toContain('Expand the first scene.');
    expect(streamResponse.body).toContain('focus on emotional tension');

    await app.close();
  });
});
