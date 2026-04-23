import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/app';
import { query } from '../src/common/db';

const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'test-password-123';

describe('auth', () => {
  beforeAll(async () => {
    await query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  afterAll(async () => {
    await query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  it('returns health status without auth', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('registers a new user', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: testEmail,
        password: testPassword,
        displayName: 'Test User',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      tokenType: 'Bearer',
      user: { email: testEmail, displayName: 'Test User' },
    });
    expect(body.accessToken).toBeTruthy();
    expect(body.user.id).toBeTruthy();
  });

  it('rejects duplicate registration', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: testEmail, password: testPassword },
    });

    expect(response.statusCode).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: testEmail, password: testPassword },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      tokenType: 'Bearer',
      user: { email: testEmail },
    });
    expect(body.accessToken).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: testEmail, password: 'wrong-password' },
    });

    expect(response.statusCode).toBe(401);
  });
});
