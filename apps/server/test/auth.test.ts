import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/app';

describe('server bootstrap', () => {
  it('returns health status without auth', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('returns a bearer token for the demo login endpoint', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'creator@example.com',
        password: 'dev-password'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tokenType: 'Bearer',
      user: {
        email: 'creator@example.com'
      }
    });
  });
});
