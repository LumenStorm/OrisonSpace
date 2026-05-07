import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { decodeJwt } from 'jose';
import { buildServer } from '../src/app';
import { query } from '../src/common/db';
import { createToken } from '../src/modules/auth/plugin';

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

  it('returns the current user for a valid access token', async () => {
    const app = buildServer();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: testEmail, password: testPassword },
    });

    const { accessToken } = login.json();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        email: testEmail,
      },
    });
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

  it('issues tokens that expire after 72 hours', async () => {
    const token = await createToken('user-123');
    const payload = decodeJwt(token);

    expect(payload.iat).toBeTypeOf('number');
    expect(payload.exp).toBeTypeOf('number');
    expect(payload.exp! - payload.iat!).toBe(72 * 60 * 60);
  });
});
