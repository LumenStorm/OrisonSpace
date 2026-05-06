import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerOrchestrationProxy } from '../src/modules/orchestration/proxy';

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
  await app.register(registerOrchestrationProxy);
  await app.ready();
  return app;
}

describe('orchestration proxy', () => {
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

  it('forwards POST /v1/orchestration/runs to the agent', async () => {
    globalThis.fetch = buildMock(captured, { runId: 'run-1', status: 'queued' }, 202);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/orchestration/runs',
      headers: { authorization: 'Bearer token-abc', 'content-type': 'application/json' },
      payload: { projectPath: 'C:\\demo', requirement: 'do it' },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ runId: 'run-1', status: 'queued' });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toMatch(/\/v1\/orchestration\/runs$/);
    expect((captured[0].init?.headers as Record<string, string>).authorization).toBe('Bearer token-abc');
  });

  it('forwards GET /v1/orchestration/runs/:runId', async () => {
    globalThis.fetch = buildMock(captured, { runId: 'run-1', status: 'completed' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/orchestration/runs/run-1',
      headers: { authorization: 'Bearer token-xyz' },
    });

    expect(response.statusCode).toBe(200);
    expect(captured[0].url).toMatch(/\/v1\/orchestration\/runs\/run-1$/);
  });

  it('forwards POST /v1/orchestration/actions', async () => {
    globalThis.fetch = buildMock(captured, { runId: 'run-1', status: 'completed' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/orchestration/actions',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      payload: { runId: 'run-1', action: 'accept_current' },
    });

    expect(response.statusCode).toBe(200);
    expect(captured[0].url).toMatch(/\/v1\/orchestration\/actions$/);
  });

  it('forwards POST /v1/orchestration/auto-mode (previously 404)', async () => {
    globalThis.fetch = buildMock(captured, { autoModeId: 'auto-1', status: 'running' }, 202);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/orchestration/auto-mode',
      headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
      payload: { projectPath: 'C:\\demo', mode: 'generate' },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ autoModeId: 'auto-1', status: 'running' });
    expect(captured[0].url).toMatch(/\/v1\/orchestration\/auto-mode$/);
    expect((captured[0].init?.headers as Record<string, string>).authorization).toBe('Bearer token');
  });

  it('forwards POST /v1/orchestration/auto-mode/actions (previously 404)', async () => {
    globalThis.fetch = buildMock(captured, { autoModeId: 'auto-1', status: 'paused' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/orchestration/auto-mode/actions',
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      payload: { autoModeId: 'auto-1', action: 'pause' },
    });

    expect(response.statusCode).toBe(200);
    expect(captured[0].url).toMatch(/\/v1\/orchestration\/auto-mode\/actions$/);
  });

  it('forwards GET /v1/orchestration/auto-mode/:autoModeId (previously 404)', async () => {
    globalThis.fetch = buildMock(captured, { autoModeId: 'auto-1', status: 'running' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/orchestration/auto-mode/auto-1',
      headers: { authorization: 'Bearer t' },
    });

    expect(response.statusCode).toBe(200);
    expect(captured[0].url).toMatch(/\/v1\/orchestration\/auto-mode\/auto-1$/);
  });

  it('forwards POST /v1/orchestration/auto-mode/restore (previously 404)', async () => {
    globalThis.fetch = buildMock(captured, { restored: [] });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/orchestration/auto-mode/restore',
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      payload: { projectPath: 'C:\\demo' },
    });

    expect(response.statusCode).toBe(200);
    expect(captured[0].url).toMatch(/\/v1\/orchestration\/auto-mode\/restore$/);
  });

  it('preserves the upstream status code for non-2xx responses', async () => {
    globalThis.fetch = buildMock(captured, { error: 'auto mode not found' }, 404);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/orchestration/auto-mode/missing',
      headers: { authorization: 'Bearer t' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'auto mode not found' });
  });
});
