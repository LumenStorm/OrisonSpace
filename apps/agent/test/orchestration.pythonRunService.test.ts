import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunService } from '../src/engine/runService';

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

describe('python-backed orchestration chain', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_BY_NODE;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
  });

  it('reaches delivered using python node executors', { timeout: 30000 }, async () => {
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
