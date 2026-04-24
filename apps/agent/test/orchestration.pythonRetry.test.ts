import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/engine/runService';

describe('python retry and human handoff', () => {
  it('routes to human_in_loop when a non-retryable python error occurs', async () => {
    const service = createRunService({ forcePythonFailure: true });

    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Break the planner.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('human_in_loop');
    expect(run.review?.summary ?? '').toContain('python node failed');
  });
});
