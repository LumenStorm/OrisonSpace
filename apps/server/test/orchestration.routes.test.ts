import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/app';

describe('orchestration routes', () => {
  it('creates a run and returns a run snapshot', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/orchestration/runs',
      payload: {
        projectPath: 'I:/workspace/demo',
        requirement: 'Generate a suspenseful chain.',
        configRoot: 'I:/workspace/demo/project-config/agents'
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBeTruthy();
    expect(response.json().runId).toBeTruthy();
  });
});
