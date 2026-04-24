import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

describe('openai story planner failure path', () => {
  it('routes to human_in_loop when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;

    const service = createRunService();
    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a dark outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('human_in_loop');
    expect(run.currentNodeId).toBe('story-planner-agent');
    expect(run.review?.summary ?? '').toContain('OPENAI_API_KEY');
  });
});
