import './loadEnv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/app';
import { initDatabase, query } from '../src/common/db';

const testEmail = `project-test-${Date.now()}@example.com`;
const localFingerprint = `local_project_${Date.now()}`;
let token = '';
let createdProjectId = '';

describe('project routes', () => {
  beforeAll(async () => {
    await initDatabase();

    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: testEmail,
        password: 'test-pass-123',
        displayName: 'Project Tester'
      }
    });

    token = response.json().accessToken;
  });

  afterAll(async () => {
    if (createdProjectId) {
      await query('DELETE FROM projects WHERE project_id = $1', [createdProjectId]);
    }
    await query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  it('creates a project and returns a zero-padded sequential project id', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Cold City',
        type: 'novel',
        localFingerprint
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      projectId: expect.stringMatching(/^\d{5}$/),
      name: 'Cold City',
      type: 'novel'
    });

    createdProjectId = response.json().projectId;
  });
});
