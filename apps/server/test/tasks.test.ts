import './loadEnv';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/app';
import { initDatabase, query } from '../src/common/db';

const testEmail = `task-test-${Date.now()}@example.com`;
const projectFingerprint = `task-project-${Date.now()}`;
let token = '';
let projectId = '';

describe('task routes', () => {
  beforeAll(async () => {
    await initDatabase();

    const app = buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: testEmail, password: 'test-pass-123', displayName: 'Task Tester' },
    });
    token = res.json().accessToken;

    const projectRes = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Task Project',
        type: 'novel',
        localFingerprint: projectFingerprint
      }
    });

    projectId = projectRes.json().projectId;
  });

  afterAll(async () => {
    if (projectId) {
      await query('DELETE FROM task_asset_refs WHERE task_id IN (SELECT task_id FROM tasks WHERE project_id = $1)', [projectId]);
      await query('DELETE FROM tasks WHERE project_id = $1', [projectId]);
    }
    if (projectId) {
      await query('DELETE FROM projects WHERE project_id = $1', [projectId]);
    }
    await query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  it('creates a task and returns a queued response with a server-generated task id', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        projectId,
        targetId: 'act_1',
        assetIds: ['char_001'],
        type: 'outline.rewrite',
        name: '重写第一幕冲突',
        description: '强化主角和对手第一次正面冲突',
        input: '让冲突更紧张'
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().taskId).toMatch(/^\d{17}_\d{5}$/);
    expect(response.json().status).toBe('queued');
  });

  it('returns a completed mock result when the task is queried later', async () => {
    const app = buildServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        projectId,
        targetId: 'act_1',
        assetIds: ['char_002'],
        type: 'outline.rewrite',
        name: '重写第一幕氛围',
        description: '让第一幕更黑暗',
        input: 'Make it darker.'
      }
    });

    const createdTaskId = createResponse.json().taskId as string;

    let response = await app.inject({
      method: 'GET',
      url: `/v1/tasks/${createdTaskId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    for (let attempt = 0; attempt < 10 && response.json().status !== 'completed'; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      response = await app.inject({
        method: 'GET',
        url: `/v1/tasks/${createdTaskId}`,
        headers: { authorization: `Bearer ${token}` },
      });
    }

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      taskId: createdTaskId,
      status: 'completed',
      outputType: 'patch'
    });
  });
});
