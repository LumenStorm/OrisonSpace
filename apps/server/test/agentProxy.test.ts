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

  it('forwards continuation list and restore routes', async () => {
    globalThis.fetch = buildMock(captured, {
      continuations: [
        {
          continuationId: 'cont-1',
          sessionId: 'session-1',
          workflowState: { activeSkill: 'story-setup', checkpoints: ['outline-ready'] },
        },
      ],
    }) as any;

    const restoreMock = buildMock(captured, {
      restored: {
        sourceSessionId: 'session-1',
        session: { id: 'session-fork-1', parentId: 'session-1', sessionRole: 'fork' },
        workflowState: { activeSkill: 'story-setup', checkpoints: ['outline-ready'] },
      },
    }) as any;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/continuations/restore')) {
        return restoreMock(input, init);
      }
      return (buildMock(captured, {
        continuations: [
          {
            continuationId: 'cont-1',
            sessionId: 'session-1',
            workflowState: { activeSkill: 'story-setup', checkpoints: ['outline-ready'] },
          },
        ],
      })(input, init));
    }) as any;

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/agent/sessions/session-1/continuations',
      headers: { authorization: 'Bearer token-abc' },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      continuations: [{ continuationId: 'cont-1' }],
    });

    const restoreResponse = await app.inject({
      method: 'POST',
      url: '/v1/agent/sessions/session-1/continuations/restore',
      headers: { authorization: 'Bearer token-abc', 'content-type': 'application/json' },
      payload: { continuationId: 'cont-1' },
    });

    expect(restoreResponse.statusCode).toBe(200);
    expect(restoreResponse.json()).toMatchObject({
      restored: {
        session: { id: 'session-fork-1' },
      },
    });
    expect(captured[0]?.url).toContain('/v1/agent/sessions/session-1/continuations');
    expect(captured[1]?.url).toContain('/v1/agent/sessions/session-1/continuations/restore');
    expect(captured[1]?.init?.body).toBe(JSON.stringify({ continuationId: 'cont-1' }));
  });
});
