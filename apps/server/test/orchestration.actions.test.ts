import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';
import { createActionService } from '../src/modules/orchestration/engine/actionService';

const MOCK_STORY_PLAN = JSON.stringify({
  title: 'Mock Story',
  premise: 'A test premise',
  tone: 'dark',
  acts: [{ id: 'act_1', title: 'Act 1', goal: 'Open', conflict: 'None', turn: 'None' }],
  characters: [{ id: 'char_1', name: 'Hero', role: 'protagonist', goal: 'survive', risk: 'death' }]
});

describe('actionService', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_STORY_PLAN;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
  });

  it('acceptCurrent finalizes a human_in_loop run to delivered', async () => {
    const runService = createRunService({ reviewMode: 'escalate' });
    const run = await runService.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Test accept action',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });
    expect(run.status).toBe('human_in_loop');

    const actionService = createActionService();
    const result = await actionService.acceptCurrent(run.runId);

    expect(result.status).toBe('delivered');
    expect(result.archive).not.toBeNull();
    expect(result.delivery).not.toBeNull();
    expect(result.feedback).not.toBeNull();
  });

  it('abortRun marks run as failed', async () => {
    const runService = createRunService({ reviewMode: 'escalate' });
    const run = await runService.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Test abort action',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    const actionService = createActionService();
    const result = await actionService.abortRun(run.runId);

    expect(result.status).toBe('failed');
    expect(result.review?.reasons).toContain('user_abort');
  });

  it('throws when accepting a non-waiting run', async () => {
    const runService = createRunService();
    const run = await runService.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Test invalid accept',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });
    expect(run.status).toBe('delivered');

    const actionService = createActionService();
    await expect(actionService.acceptCurrent(run.runId)).rejects.toThrow('not awaiting action');
  });
});
