import { describe, expect, it } from 'vitest';
import { createArchiveRecord } from '../src/modules/orchestration/engine/archiveService';
import { buildDeliveryOutput } from '../src/modules/orchestration/engine/deliveryService';
import { buildFeedback } from '../src/modules/orchestration/engine/feedbackService';
import type { RunSnapshot } from '../src/modules/orchestration/contracts/run';

function makeRun(overrides?: Partial<RunSnapshot>): RunSnapshot {
  return {
    runId: 'run_test',
    status: 'approved',
    currentNodeId: null,
    projectPath: 'I:/workspace/demo',
    completedNodes: ['intake-agent', 'draft-writer-agent', 'multi-review-agent'],
    pendingNodes: [],
    artifacts: {
      'intake.requirement': { requirement: 'test' },
      'draft.initial': { text: 'Draft content' },
      'memory.continuity': { rules: ['keep tone'] },
      'review.latest': { mode: 'pass' }
    },
    review: {
      verdict: 'pass',
      summary: 'All checks passed',
      reasons: []
    },
    archive: null,
    delivery: null,
    feedback: null,
    ...overrides
  };
}

describe('archiveService', () => {
  it('creates an archive record with versionId and promptFiles', () => {
    const run = makeRun();
    const archive = createArchiveRecord(run);

    expect(archive.versionId).toMatch(/^ver_/);
    expect(archive.archivedAt).toBeTruthy();
    expect(archive.promptFiles).toHaveLength(3);
    expect(archive.promptFiles[0]).toContain('intake-agent');
  });
});

describe('deliveryService', () => {
  it('builds delivery output from run artifacts', () => {
    const run = makeRun();
    const delivery = buildDeliveryOutput(run);

    expect(delivery.deliveryId).toMatch(/^dlv_/);
    expect(delivery.format).toBe('json');
    expect(delivery.content).toHaveProperty('draft');
    expect(delivery.content).toHaveProperty('review');
    expect(delivery.summary).toContain('3');
  });

  it('handles run with no draft artifact', () => {
    const run = makeRun({ artifacts: {} });
    const delivery = buildDeliveryOutput(run);

    expect(delivery.deliveryId).toMatch(/^dlv_/);
    expect(delivery.content).toEqual({});
  });
});

describe('feedbackService', () => {
  it('builds feedback with asset patches from continuity memory', () => {
    const run = makeRun();
    const feedback = buildFeedback(run);

    expect(feedback.feedbackId).toMatch(/^fb_/);
    expect(feedback.assetPatches.length).toBeGreaterThan(0);
    expect(feedback.assetPatches.some((p) => p.target === 'asset')).toBe(true);
    expect(feedback.memo).toContain('pass');
  });

  it('extracts rule patches from review reasons', () => {
    const run = makeRun({
      review: {
        verdict: 'revise',
        summary: 'Needs work',
        reasons: ['pacing_too_fast', 'tone_inconsistent']
      }
    });
    const feedback = buildFeedback(run);

    expect(feedback.assetPatches.some((p) => p.target === 'rule')).toBe(true);
    expect(feedback.memo).toContain('revise');
  });

  it('handles run with no review', () => {
    const run = makeRun({ review: null });
    const feedback = buildFeedback(run);

    expect(feedback.memo).toContain('无审核记录');
  });
});
