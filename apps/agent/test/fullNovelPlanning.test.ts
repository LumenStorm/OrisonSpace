import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { createFullNovelPlanningBundle } from '../src/engine/autoMode/fullNovelPlanning';

const TEST_DIR = path.join(process.cwd(), 'test-tmp-full-novel-planning');

describe('full novel planning bundle', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      path.join(TEST_DIR, 'project.yaml'),
      [
        'meta:',
        '  id: "full_001"',
        '  name: "Full Novel"',
        '  type: novel',
        'novel:',
        '  target_chapters: 3',
      ].join('\n'),
      'utf8',
    );
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('creates a reusable planning bundle and chapter slots from the plot summary', () => {
    const result = createFullNovelPlanningBundle({
      projectPath: TEST_DIR,
      autoModeId: 'auto_full',
      plotSummary: 'A courier uncovers a conspiracy in a sealed city.',
    });

    expect(result.chapterIds).toEqual(['ch_001', 'ch_002', 'ch_003']);
    expect(result.bundle.artifacts.world_setting).toMatchObject({
      premise: 'A courier uncovers a conspiracy in a sealed city.',
    });
    expect(result.bundle.artifacts.episode_outlines).toHaveLength(3);
    expect(existsSync(result.bundlePath)).toBe(true);

    const project = YAML.parse(readFileSync(path.join(TEST_DIR, 'project.yaml'), 'utf8')) as any;
    expect(project.creative.creative_brief.rawRequirement).toBe('A courier uncovers a conspiracy in a sealed city.');
    expect(project.creative.asset_cards).toHaveLength(3);
    expect(project.novel.chapters.map((chapter: any) => chapter.id)).toEqual(['ch_001', 'ch_002', 'ch_003']);
  });
});
