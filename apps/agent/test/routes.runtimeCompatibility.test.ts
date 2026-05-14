import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import { buildAgent } from '../src/app';
import { registry } from '../src/tool/registry';

vi.mock('../src/skill/discovery', () => ({
  discoverSkills: vi.fn(async () => []),
}));

const generateMock = vi.fn();

vi.mock('../src/provider/ipc-provider', () => ({
  generate: (...args: unknown[]) => generateMock(...args),
}));

describe('agent runtime route compatibility', () => {
  const testToolId = 'runtime_test_tool';
  let projectPath = '';
  let externalSkillsRoot = '';

  beforeEach(() => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-agent-runtime-'));
    externalSkillsRoot = mkdtempSync(path.join(os.tmpdir(), 'orison-agent-runtime-skills-'));
    generateMock.mockReset();
    registry.register({
      id: testToolId,
      description: 'Test tool for runtime compatibility coverage.',
      parameters: z.object({
        topic: z.string(),
      }),
      execute: async ({ topic }: { topic: string }) => ({
        title: 'runtime test tool',
        output: `tool output for ${topic}`,
      }),
    });
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
    rmSync(externalSkillsRoot, { recursive: true, force: true });
  });

  it('keeps session create, message, stream, confirm, and skill routes stable', async () => {
    generateMock
      .mockResolvedValueOnce({
        content: 'I will use a tool first.',
        toolCalls: [
          {
            id: randomUUID(),
            name: testToolId,
            arguments: JSON.stringify({ topic: 'compatibility' }),
          },
        ],
        finishReason: 'tool_calls',
      })
      .mockResolvedValueOnce({
        content: 'Tool work is complete.',
        finishReason: 'stop',
      })
      .mockResolvedValueOnce({
        content: 'Streaming response complete.',
        finishReason: 'stop',
      });

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

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions',
      payload: {
        agentName: 'writer',
        projectPath,
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().id).toEqual(expect.any(String));
    const sessionId = createResponse.json().id as string;

    const messageResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/messages`,
      payload: {
        content: 'Test the runtime boundary.',
      },
    });

    expect(messageResponse.statusCode).toBe(200);
    const messagePayload = messageResponse.json() as {
      messages: Array<{ role: string; content: string; toolCalls?: unknown[]; toolResults?: unknown[] }>;
    };
    expect(messagePayload.messages).toHaveLength(3);
    expect(messagePayload.messages[0]).toMatchObject({
      role: 'assistant',
      content: 'I will use a tool first.',
    });
    expect(messagePayload.messages[0].toolCalls).toHaveLength(1);
    expect(messagePayload.messages[1]).toMatchObject({
      role: 'tool',
      content: 'tool output for compatibility',
    });
    expect(messagePayload.messages[1].toolResults).toHaveLength(1);
    expect(messagePayload.messages[2]).toMatchObject({
      role: 'assistant',
      content: 'Tool work is complete.',
    });

    const streamResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/stream`,
      payload: {
        content: 'Now stream a response.',
      },
    });

    expect(streamResponse.statusCode).toBe(200);
    expect(streamResponse.headers['content-type']).toContain('text/event-stream');
    expect(streamResponse.body).toContain('event: assistant');
    expect(streamResponse.body).toContain('Streaming response complete.');
    expect(streamResponse.body).toContain('event: done');

    const skillsResponse = await app.inject({
      method: 'GET',
      url: `/v1/agent/skills?projectPath=${encodeURIComponent(projectPath)}`,
    });

    expect(skillsResponse.statusCode).toBe(200);
    expect((skillsResponse.json() as { skills: Array<{ name: string }> }).skills.map((skill) => skill.name).sort()).toEqual([
      'scene-expander',
      'story-setup',
    ]);

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/skills/story-setup/execute`,
      payload: {},
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      skill: 'story-setup',
      status: 'completed',
      continuation: {
        sessionId,
        workflowState: {
          activeSkill: 'story-setup',
        },
      },
    });

    const confirmResponse = await app.inject({
      method: 'POST',
      url: `/v1/agent/sessions/${sessionId}/confirm`,
      payload: {
        callId: 'missing-call',
        approved: true,
      },
    });

    expect(confirmResponse.statusCode).toBe(404);
    expect(confirmResponse.json()).toMatchObject({
      error: expect.any(String),
    });

    await app.close();
  });
});
