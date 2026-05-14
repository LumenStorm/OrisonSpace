import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAgentProxy } from '../src/modules/agent/proxy';

const ORIGINAL_FETCH = globalThis.fetch;

type CapturedCall = {
  url: string;
  init?: RequestInit;
};

function buildMock(captured: CapturedCall[], responseBody: unknown, responseStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init });
    return new Response(JSON.stringify(responseBody), {
      status: responseStatus,
      headers: { 'content-type': 'application/json' },
    });
  });
}

async function buildIsolatedProxyApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(registerAgentProxy);
  await app.ready();
  return app;
}

describe('agent proxy', () => {
  let captured: CapturedCall[];
  let app: FastifyInstance;

  beforeEach(async () => {
    captured = [];
    app = await buildIsolatedProxyApp();
  });

  afterEach(async () => {
    await app.close();
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it('forwards GET /v1/agent/skills with projectPath query', async () => {
    globalThis.fetch = buildMock(captured, {
      skills: [
        { name: 'story-setup', description: 'Prepare story context', location: 'I:/skills/story-setup', format: 'manifest' },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/agent/skills?projectPath=I%3A%5Cecho%5Cproject',
      headers: { authorization: 'Bearer token-abc' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      skills: [{ name: 'story-setup' }],
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toContain('/v1/agent/skills?projectPath=');
    expect((captured[0].init?.headers as Record<string, string>).authorization).toBe('Bearer token-abc');
  });

  it('forwards skill execution payloads and preserves continuation response shape', async () => {
    globalThis.fetch = buildMock(captured, {
      skill: 'story-setup',
      status: 'completed',
      outputs: ['Prepare the story context.'],
      continuation: {
        sessionId: 'session-1',
        compacted: {
          sessionId: 'session-1',
          summary: '',
          tail: [],
        },
        workflowState: {
          activeSkill: 'story-setup',
          checkpoints: ['outline-ready'],
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions/session-1/skills/story-setup/execute',
      headers: { authorization: 'Bearer token-xyz', 'content-type': 'application/json' },
      payload: {
        input: 'Build a noir setup',
        artifactIds: ['outline-1'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      skill: 'story-setup',
      continuation: {
        sessionId: 'session-1',
        workflowState: {
          activeSkill: 'story-setup',
        },
      },
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toMatch(/\/v1\/agent\/sessions\/session-1\/skills\/story-setup\/execute$/);
    expect(captured[0].init?.body).toBe(JSON.stringify({
      input: 'Build a noir setup',
      artifactIds: ['outline-1'],
    }));
  });
});
