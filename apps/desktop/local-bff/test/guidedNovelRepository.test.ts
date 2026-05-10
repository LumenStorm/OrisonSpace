import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  loadGuidedNovelState,
  saveGuidedNovelState,
  savePlanningBaseline,
} from '../sync/guidedNovelRepository';

const TEST_PROJECT_DIR = path.join(process.cwd(), 'test-tmp-guided-novel');
const NOW = '2026-05-10T00:00:00.000Z';

describe('guidedNovelRepository', () => {
  afterEach(() => {
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  it('persists and reloads interview state under the project root', () => {
    saveGuidedNovelState(TEST_PROJECT_DIR, {
      session: {
        sessionId: 'session_1',
        projectPath: TEST_PROJECT_DIR,
        status: 'interviewing',
        baselineVersion: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
      interviewDraft: {
        concept: { premise: 'A city remembers crimes.' },
        cast: {},
        world: {},
        plot: {},
        constraints: {},
        confidence: {
          concept: 1,
          cast: 0,
          world: 0,
          plot: 0,
          constraints: 0,
          canEnterPlanning: false,
        },
      },
    });

    const loaded = loadGuidedNovelState(TEST_PROJECT_DIR);
    expect(loaded?.session?.status).toBe('interviewing');
    expect((loaded?.interviewDraft?.concept as Record<string, unknown>)?.premise).toBe(
      'A city remembers crimes.',
    );
  });

  it('stores planning baseline versions independently from interview draft', () => {
    savePlanningBaseline(TEST_PROJECT_DIR, 2, {
      creative_brief: { rawRequirement: 'A detective enters the dream market.' },
    });

    const loaded = loadGuidedNovelState(TEST_PROJECT_DIR);
    expect(loaded?.planningBaseline?.version).toBe(2);
  });

  it('persists planning baseline when saving the full guided state', () => {
    saveGuidedNovelState(TEST_PROJECT_DIR, {
      session: {
        sessionId: 'session_2',
        projectPath: TEST_PROJECT_DIR,
        status: 'planning',
        baselineVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
      planningBaseline: {
        version: 1,
        fields: {
          creative_brief: {
            rawRequirement: 'A grieving archivist rebuilds a dead city.',
            taboos: [],
            userConstraints: [],
          },
        },
      },
    });

    const loaded = loadGuidedNovelState(TEST_PROJECT_DIR);
    expect(loaded?.planningBaseline?.version).toBe(1);
    expect(loaded?.planningBaseline?.fields.creative_brief?.rawRequirement).toBe(
      'A grieving archivist rebuilds a dead city.',
    );
  });
});
