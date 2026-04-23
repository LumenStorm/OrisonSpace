import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/app';
import { query } from '../src/common/db';

const testEmail = `task-test-${Date.now()}@example.com`;
let token = '';

describe('task routes', () => {
  beforeAll(async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: testEmail, password: 'test-pass-123', displayName: 'Task Tester' },
    });
    token = res.json().accessToken;
  });

  afterAll(async () => {
    await query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  it('creates a task and returns a queued response', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        taskId: 'task_1',
        taskType: 'outline.rewrite',
        projectFingerprint: 'project_demo',
        selectedScope: { module: 'outline', entityId: 'act_1' },
        contextPayload: {
          outline: {
            title: 'Cold City',
            acts: [{ id: 'act_1', title: 'Arrival', summary: 'A detective arrives.' }]
          }
        },
        userInstruction: 'Make it more suspenseful.',
        privacyLevel: 'minimal',
        expectedOutputType: 'patch'
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      taskId: 'task_1',
      status: 'queued'
    });
  });

  it('returns a completed mock result when the task is queried later', async () => {
    const app = buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        taskId: 'task_2',
        taskType: 'outline.rewrite',
        projectFingerprint: 'project_demo',
        selectedScope: { module: 'outline', entityId: 'act_1' },
        contextPayload: {
          outline: {
            title: 'Cold City',
            acts: [{ id: 'act_1', title: 'Arrival', summary: 'A detective arrives.' }]
          }
        },
        userInstruction: 'Make it darker.',
        privacyLevel: 'minimal',
        expectedOutputType: 'patch'
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/tasks/task_2',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      taskId: 'task_2',
      status: 'completed',
      outputType: 'patch'
    });
  });
});
