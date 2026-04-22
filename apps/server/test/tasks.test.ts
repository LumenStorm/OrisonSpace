import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/app';

describe('task routes', () => {
  it('creates a task and returns a queued response', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/tasks',
      payload: {
        taskId: 'task_1',
        taskType: 'story.rewrite',
        projectFingerprint: 'project_demo',
        selectedScope: { module: 'story', entityId: 'act_1' },
        contextPayload: {
          story: {
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
      payload: {
        taskId: 'task_2',
        taskType: 'story.rewrite',
        projectFingerprint: 'project_demo',
        selectedScope: { module: 'story', entityId: 'act_1' },
        contextPayload: {
          story: {
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
      url: '/v1/tasks/task_2'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      taskId: 'task_2',
      status: 'completed',
      outputType: 'patch'
    });
  });
});
