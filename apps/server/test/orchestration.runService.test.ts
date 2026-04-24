import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunService } from '../src/modules/orchestration/engine/runService';

const MOCK_BY_NODE = JSON.stringify({
  __mock_by_node__: {
    'intake-agent': {
      genre: '悬疑', tone: 'dark', setting: '都市',
      premise: 'A detective investigates disappearances',
      constraints: ['max 50k words']
    },
    'asset-loader-agent': {
      styleGuide: 'noir', references: ['Dark City'],
      worldRules: ['night is eternal'],
      characterTemplates: [{ role: 'detective', archetype: 'loner', traits: ['sharp'] }]
    },
    'story-planner-agent': {
      title: 'Mock Story', premise: 'A test premise', tone: 'dark',
      acts: [{ id: 'act_1', title: 'Act 1', goal: 'Open', conflict: 'None', turn: 'None' }],
      characters: [{ id: 'char_1', name: 'Hero', role: 'protagonist', goal: 'survive', risk: 'death' }]
    },
    'chapter-task-agent': [
      { id: 'chapter_1', title: 'Opening', goal: 'Introduce hero',
        scenes: ['office'], characters: ['Hero'], wordTarget: 3000 }
    ],
    'draft-writer-agent': {
      title: 'Opening', text: 'The night fell...', wordCount: 3000, chapterId: 'chapter_1'
    },
    'continuity-memory-agent': {
      characters: [{ name: 'Hero', status: 'active', lastAction: 'entered office' }],
      timeline: ['night falls'], foreshadowing: ['mysterious call'], toneRules: ['keep dark']
    },
    'multi-review-agent': {
      verdict: 'pass', summary: 'Quality meets standards',
      dimensions: [{ name: 'structure', score: 8, comment: 'solid' }], reasons: []
    }
  }
});

describe('orchestration run service', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_RESPONSES_MOCK_JSON = MOCK_BY_NODE;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_RESPONSES_MOCK_JSON;
  });

  it('runs the main chain and reaches delivered when review passes', { timeout: 30000 }, async () => {
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

  it('routes to revision_pending when review requests revision', { timeout: 30000 }, async () => {
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
