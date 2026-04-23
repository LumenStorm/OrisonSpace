import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

describe('orchestration run service', () => {
  it('runs the main chain and reaches approved when review passes', async () => {
    const service = createRunService();

    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a moody urban outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('approved');
    expect(run.completedNodes).toContain('multi-review-agent');
    expect(run.artifacts['planning.storyPlan']).toBeTruthy();
  });

  it('routes to revision_pending when review requests revision', async () => {
    const service = createRunService({ reviewMode: 'revise' });

    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a moody urban outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('revision_pending');
    expect(run.currentNodeId).toBe('targeted-revision-agent');
  });
});
