import './loadEnv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/app';
import { initDatabase, query } from '../src/common/db';

const testEmail = `task-list-test-${Date.now()}@example.com`;
const projectFingerprint = `task-list-project-${Date.now()}`;
let token = '';
let projectId = '';

describe('task list routes', () => {
  beforeAll(async () => {
    await initDatabase();

    const app = buildServer();
    const registerRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: testEmail,
        password: 'test-pass-123',
        displayName: 'Task List Tester'
      }
    });

    token = registerRes.json().accessToken;

    const projectRes = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Task List Project',
        type: 'novel',
        localFingerprint: projectFingerprint
      }
    });

    projectId = projectRes.json().projectId;

    await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        projectId,
        targetId: 'act_1',
        assetIds: ['char_001', 'loc_002'],
        type: 'outline.rewrite',
        name: '重写第一幕冲突',
        description: '强化主角和对手第一次正面冲突',
        input: '让冲突更紧张'
      }
    });

  });

  afterAll(async () => {
    if (projectId) {
      await query('DELETE FROM task_asset_refs WHERE task_id IN (SELECT task_id FROM tasks WHERE project_id = $1)', [projectId]);
      await query('DELETE FROM tasks WHERE project_id = $1', [projectId]);
      await query('DELETE FROM project_assets WHERE project_id = $1', [projectId]);
      await query('DELETE FROM projects WHERE project_id = $1', [projectId]);
    }

    await query('DELETE FROM users WHERE email = $1', [testEmail]);
  });

  it('lists project tasks with related asset ids using batched hydration', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        expect.objectContaining({
          projectId,
          assetIds: ['char_001', 'loc_002'],
          type: 'outline.rewrite'
        })
      ]
    });
  });

  it('lists project assets from the asset index table', async () => {
    const app = buildServer();
    let response = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/assets`,
      headers: { authorization: `Bearer ${token}` }
    });

    for (let attempt = 0; attempt < 10 && response.json().items.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      response = await app.inject({
        method: 'GET',
        url: `/v1/projects/${projectId}/assets`,
        headers: { authorization: `Bearer ${token}` }
      });
    }

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          assetId: 'char_001',
          projectId,
          assetType: 'unknown',
          sourceTaskId: expect.any(String)
        })
      ])
    });
  });
});
