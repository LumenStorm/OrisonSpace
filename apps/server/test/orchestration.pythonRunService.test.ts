import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

const MOCK_STORY_PLAN = JSON.stringify({
  title: 'Mock Story',
  premise: 'A test premise',
  tone: 'dark',
  acts: [{ id: 'act_1', title: 'Act 1', goal: 'Open', conflict: 'None', turn: 'None' }],
  characters: [{ id: 'char_1', name: 'Hero', role: 'protagonist', goal: 'survive', risk: 'death' }]
});

describe('python-backed orchestration chain', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_STORY_PLAN;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
  });

  it('reaches delivered using python node executors', async () => {
    const service = createRunService();
    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a dark outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('delivered');
    expect(run.completedNodes).toContain('multi-review-agent');
    expect(run.archive).not.toBeNull();
    expect(run.delivery).not.toBeNull();
    expect(run.feedback).not.toBeNull();
  });
});
