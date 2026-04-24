import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

const MOCK_STORY_PLAN = JSON.stringify({
  title: 'Mock Story',
  premise: 'A test premise',
  tone: 'dark',
  acts: [{ id: 'act_1', title: 'Act 1', goal: 'Open', conflict: 'None', turn: 'None' }],
  characters: [{ id: 'char_1', name: 'Hero', role: 'protagonist', goal: 'survive', risk: 'death' }]
});

describe('orchestration run service', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_STORY_PLAN;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
  });

  it('runs the main chain and reaches delivered when review passes', async () => {
    const service = createRunService();

    const run = await service.start({
      projectPath: 'I:/workspace/demo',
      requirement: 'Create a moody urban outline.',
      configRoot: 'I:/workspace/demo/project-config/agents'
    });

    expect(run.status).toBe('delivered');
    expect(run.completedNodes).toContain('multi-review-agent');
    expect(run.archive).not.toBeNull();
    expect(run.archive!.versionId).toMatch(/^ver_/);
    expect(run.delivery).not.toBeNull();
    expect(run.delivery!.deliveryId).toMatch(/^dlv_/);
    expect(run.feedback).not.toBeNull();
    expect(run.feedback!.feedbackId).toMatch(/^fb_/);
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
    expect(run.delivery).toBeNull();
  });
});
