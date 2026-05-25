import { describe, expect, it } from 'vitest';
import { parseStorySyncResponse } from '@orison/story-sync';
import { deriveStorySyncByRules } from '../src/nodes/story-sync-agent/rules';

describe('story-sync parser (re-exported from @orison/story-sync)', () => {
  it('parses a clean JSON response and keeps allowed patches', () => {
    const text = JSON.stringify({
      runId: 'IGNORED_BY_LLM',
      chapterId: 'IGNORED_BY_LLM',
      summary: 'extracted clue',
      patches: [
        {
          field: 'foreshadow_registry',
          action: 'merge',
          data: { items: [{ id: 'fs_1', title: '钥匙', content: '出现一把钥匙' }] },
          fieldVersion: 3,
          generatedBy: 'someone-else',
        },
      ],
    });
    const r = parseStorySyncResponse(text, {
      runId: 'run_1',
      chapterId: 'ch_1',
      fieldVersions: { foreshadow_registry: 3 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.runId).toBe('run_1');
    expect(r.payload.chapterId).toBe('ch_1');
    expect(r.payload.patches).toHaveLength(1);
    expect(r.payload.patches[0].generatedBy).toBe('story-sync-agent');
  });

  it('rejects payload when any patch field is not in creativeFieldKeys whitelist', () => {
    const text = JSON.stringify({
      summary: 'mixed',
      patches: [
        {
          field: 'NOT_A_FIELD',
          action: 'merge',
          data: {},
          fieldVersion: 0,
          generatedBy: 'story-sync-agent',
        },
      ],
    });
    const r = parseStorySyncResponse(text, {
      runId: 'run_1',
      chapterId: 'ch_1',
      fieldVersions: {},
    });
    expect(r.ok).toBe(false);
  });

  it('returns ok=false when no JSON can be extracted', () => {
    const r = parseStorySyncResponse('sorry I cannot help', {
      runId: 'run_1',
      chapterId: 'ch_1',
      fieldVersions: {},
    });
    expect(r.ok).toBe(false);
  });
});

describe('story-sync rules', () => {
  it('emits a foreshadow_registry merge patch when content mentions a key cue', () => {
    const out = deriveStorySyncByRules({
      chapterId: 'ch_1',
      content: '他从抽屉里取出一把铜钥匙。',
      chapterNumber: 3,
      existingForeshadow: [],
      foreshadowVersion: 0,
    });
    expect(out.patches).toHaveLength(1);
    expect(out.patches[0].field).toBe('foreshadow_registry');
    expect(out.patches[0].action).toBe('merge');
    expect(out.patches[0].generatedBy).toBe('story-sync-agent');
  });

  it('skips cues that already exist in the registry', () => {
    const out = deriveStorySyncByRules({
      chapterId: 'ch_1',
      content: '他从抽屉里取出一把铜钥匙。',
      chapterNumber: 3,
      existingForeshadow: [{ title: '钥匙线索', content: '一把钥匙', tags: ['钥匙'] }],
      foreshadowVersion: 1,
    });
    expect(out.patches).toEqual([]);
  });

  it('returns no patches when content has no recognized cues', () => {
    const out = deriveStorySyncByRules({
      chapterId: 'ch_1',
      content: '阳光洒在桌面上。',
      chapterNumber: 1,
      existingForeshadow: [],
      foreshadowVersion: 0,
    });
    expect(out.patches).toEqual([]);
  });
});
