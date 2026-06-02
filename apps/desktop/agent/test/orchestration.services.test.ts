import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createArchiveRecord, createCreativeArchiveRecord } from '../src/engine/archiveService';
import { buildDeliveryOutput } from '../src/engine/deliveryService';
import { buildFeedback, buildCreativeFeedback } from '../src/engine/feedbackService';
import type { RunSnapshot } from '../src/contracts/run';
import type { RunResult } from '../src/engine/runService';

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

function makeRunResult(overrides?: Partial<RunResult>): RunResult {
  return {
    runId: 'run_creative',
    status: 'approved',
    currentNodeId: null,
    completedNodes: ['intake-agent', 'asset-loader-agent'],
    artifacts: {
      'assets.projectContext': {
        asset_cards: [
          { id: 'char_1', name: '主角', role: 'protagonist' },
          { id: 'char_2', name: '反派', role: 'antagonist' },
        ],
        relationship_graph: {
          edges: [{ id: 'edge_1', from: 'char_1', to: 'char_2', type: 'enemy' }],
        },
      },
    },
    archive: null,
    delivery: null,
    feedback: null,
    review: null,
    ...overrides,
  };
}

describe('buildCreativeFeedback', () => {
  it('extracts and classifies asset patches from projectContext', () => {
    const run = makeRunResult();
    const existing = [{ id: 'char_1', name: '主角', status: 'locked' }];
    const fb = buildCreativeFeedback(run, existing);

    expect(fb.feedbackId).toMatch(/^fb_/);
    expect(fb.assetPatches.autoApply.length).toBeGreaterThan(0);
    expect(fb.assetPatches.needsReview.length).toBeGreaterThan(0);
  });

  it('returns empty patches when no assets artifact', () => {
    const run = makeRunResult({ artifacts: {} });
    const fb = buildCreativeFeedback(run, []);

    expect(fb.assetPatches.autoApply).toHaveLength(0);
    expect(fb.assetPatches.needsReview).toHaveLength(0);
  });
});

describe('createCreativeArchiveRecord', () => {
  const tmpDir = path.join(tmpdir(), 'archive-test-' + Date.now());

  it('lists artifact yaml files from disk', () => {
    const run = makeRunResult();
    const artifactDir = path.join(tmpDir, 'runs', run.runId, 'artifacts');
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(path.join(artifactDir, 'world_setting.yaml'), 'data: test');
    writeFileSync(path.join(artifactDir, 'asset_cards.yaml'), 'data: test');

    const record = createCreativeArchiveRecord(run, tmpDir);

    expect(record.versionId).toMatch(/^ver_/);
    expect(record.artifactFiles).toContain('world_setting.yaml');
    expect(record.artifactFiles).toContain('asset_cards.yaml');
    expect(record.completedNodes).toEqual(run.completedNodes);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty list when no artifacts dir exists', () => {
    const run = makeRunResult();
    const record = createCreativeArchiveRecord(run, '/nonexistent_path_xyz');

    expect(record.artifactFiles).toHaveLength(0);
  });
});
