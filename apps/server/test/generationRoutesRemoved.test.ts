import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Regression: the generation routes (`POST /v1/generation/:provider/text`,
 * `POST /v1/generation/:provider/image`) were deleted in the desktop-direct
 * model gateway migration. Server must no longer expose any
 * `/v1/generation/*` routes — every model HTTP call now originates on the
 * desktop main process.
 *
 * We spin up an isolated Fastify instance and try to register the same
 * route plugins `buildServer` registers — minus auth, since auth runs
 * before routing and would mask 404 with 401. Then we POST the deleted
 * paths and assert 404.
 */
describe('generation routes removed (regression)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { registerHealthRoutes } = await import('../src/common/health');
    const { registerOrchestrationProxy } = await import('../src/modules/orchestration/proxy');
    const { registerProjectRoutes } = await import('../src/modules/project/routes');
    const { registerTaskRoutes } = await import('../src/modules/task/routes');
    const { registerAuthRoutes } = await import('../src/modules/auth/routes');

    app = Fastify({ logger: false });
    await app.register(registerHealthRoutes);
    await app.register(registerAuthRoutes);
    await app.register(registerOrchestrationProxy);
    await app.register(registerProjectRoutes);
    await app.register(registerTaskRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/generation/openai/text returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/openai/text',
      payload: { model: 'gpt-4o', messages: [] },
    });
    expect(response.statusCode).toBe(404);
  });

  it('POST /v1/generation/openai/image returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/openai/image',
      payload: { model: 'gpt-image-1', prompt: 'x' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('POST /v1/generation/anthropic/text returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/anthropic/text',
      payload: { model: 'claude-3', messages: [] },
    });
    expect(response.statusCode).toBe(404);
  });

  it('POST /v1/generation/gcp/image returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/generation/gcp/image',
      payload: { model: 'imagen-3', prompt: 'x' },
    });
    expect(response.statusCode).toBe(404);
  });
});
