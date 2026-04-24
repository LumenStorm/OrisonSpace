import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';
import { createActionService } from '../src/modules/orchestration/engine/actionService';

const MOCK_BY_NODE = JSON.stringify({
  __mock_by_node__: {
    'intake-agent': { genre: '悬疑', tone: 'dark', setting: '都市', premise: 'test', constraints: [] },
    'asset-loader-agent': { styleGuide: 'noir', references: [], worldRules: [], characterTemplates: [{ role: 'det', archetype: 'loner', traits: ['sharp'] }] },
    'story-planner-agent': { title: 'Mock', premise: 'test', tone: 'dark', acts: [{ id: 'a1', title: 'A1', goal: 'g', conflict: 'c', turn: 't' }], characters: [{ id: 'c1', name: 'H', role: 'p', goal: 'g', risk: 'r' }] },
    'chapter-task-agent': [{ id: 'ch1', title: 'Ch1', goal: 'open', scenes: ['s1'], characters: ['H'], wordTarget: 2000 }],
    'draft-writer-agent': { title: 'Ch1', text: 'Draft text...', wordCount: 2000, chapterId: 'ch1' },
    'continuity-memory-agent': { characters: [{ name: 'H', status: 'active', lastAction: 'entered' }], timeline: ['night'], foreshadowing: [], toneRules: ['dark'] },
    'multi-review-agent': { verdict: 'pass', summary: 'OK', dimensions: [{ name: 'structure', score: 8, comment: 'good' }], reasons: [] }
  }
});

describe('actionService', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_BY_NODE;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
  });

  it('acceptCurrent finalizes a human_in_loop run to delivered', { timeout: 30000 }, async () => {
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

  it('abortRun marks run as failed', { timeout: 30000 }, async () => {
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

  it('throws when accepting a non-waiting run', { timeout: 30000 }, async () => {
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
