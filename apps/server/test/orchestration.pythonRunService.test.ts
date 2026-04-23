import { describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

describe('python-backed orchestration chain', () => {
  it('reaches approved using python node executors', async () => {
    const service = createRunService();
    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a dark outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('approved');
    expect(run.artifacts['planning.chapterTasks']).toMatchObject([
      { goal: 'Open the story with a Python chapter task.' }
    ]);
    expect(run.artifacts['draft.initial']).toMatchObject({
      text: 'Python initial draft output.'
    });
    expect(run.completedNodes).toContain('multi-review-agent');
  });
});
