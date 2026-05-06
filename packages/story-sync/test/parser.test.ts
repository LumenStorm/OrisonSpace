import { describe, expect, it } from 'vitest';
import { parseStorySyncResponse, parseStorySyncPatches } from '../src/parser';

describe('parseStorySyncResponse', () => {
  it('parses clean JSON and forces runId / chapterId / generatedBy', () => {
    const text = JSON.stringify({
      runId: 'IGNORED_BY_LLM',
      chapterId: 'IGNORED_BY_LLM',
      summary: 'extracted clue',
      patches: [
        {
          field: 'foreshadow_registry',
          action: 'merge',
          data: { items: [{ id: 'fs_1', title: '钥匙', content: '一把钥匙' }] },
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

  it('strips fenced markdown around the JSON block', () => {
    const text = '```json\n{"summary":"ok","patches":[]}\n```';
    const r = parseStorySyncResponse(text, {
      runId: 'run_1',
      chapterId: 'ch_1',
      fieldVersions: {},
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.patches).toEqual([]);
  });

  it('rejects payload when any patch field is not in the whitelist', () => {
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
      runId: 'r',
      chapterId: 'c',
      fieldVersions: {},
    });
    expect(r.ok).toBe(false);
  });

  it('drops patches whose action is not merge but stays ok', () => {
    const text = JSON.stringify({
      summary: 'set',
      patches: [
        {
          field: 'foreshadow_registry',
          action: 'set',
          data: { items: [] },
          fieldVersion: 0,
          generatedBy: 'story-sync-agent',
        },
      ],
    });
    const r = parseStorySyncResponse(text, {
      runId: 'r',
      chapterId: 'c',
      fieldVersions: { foreshadow_registry: 0 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.patches).toEqual([]);
  });

  it('drops patches whose fieldVersion does not match', () => {
    const text = JSON.stringify({
      summary: 'stale',
      patches: [
        {
          field: 'foreshadow_registry',
          action: 'merge',
          data: { items: [] },
          fieldVersion: 1,
          generatedBy: 'story-sync-agent',
        },
      ],
    });
    const r = parseStorySyncResponse(text, {
      runId: 'r',
      chapterId: 'c',
      fieldVersions: { foreshadow_registry: 5 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.patches).toEqual([]);
  });

  it('returns ok=false when no JSON can be extracted', () => {
    const r = parseStorySyncResponse('sorry I cannot help', {
      runId: 'r',
      chapterId: 'c',
      fieldVersions: {},
    });
    expect(r.ok).toBe(false);
  });

  it('returns ok=false on malformed JSON', () => {
    const r = parseStorySyncResponse('{not valid json', {
      runId: 'r',
      chapterId: 'c',
      fieldVersions: {},
    });
    expect(r.ok).toBe(false);
  });
});

describe('parseStorySyncPatches', () => {
  it('returns ok=false when input is not an array', () => {
    const r = parseStorySyncPatches({ foo: 'bar' }, {
      runId: 'r',
      chapterId: 'c',
      fieldVersions: {},
    });
    expect(r.ok).toBe(false);
  });

  it('rejects when any patch carries a non-whitelisted field', () => {
    const r = parseStorySyncPatches(
      [
        {
          field: 'NOT_A_FIELD',
          action: 'merge',
          data: {},
          fieldVersion: 0,
        },
      ],
      { runId: 'r', chapterId: 'c', fieldVersions: {} },
    );
    expect(r.ok).toBe(false);
  });

  it('keeps a valid pre-computed patch', () => {
    const r = parseStorySyncPatches(
      [
        {
          field: 'foreshadow_registry',
          action: 'merge',
          data: { items: [{ id: 'fs_1' }] },
          fieldVersion: 2,
          generatedBy: 'desktop-impersonator',
        },
      ],
      { runId: 'r', chapterId: 'c', fieldVersions: { foreshadow_registry: 2 } },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.patches).toHaveLength(1);
    expect(r.payload.patches[0].generatedBy).toBe('story-sync-agent');
  });

  it('drops stale-version patches but stays ok', () => {
    const r = parseStorySyncPatches(
      [
        {
          field: 'foreshadow_registry',
          action: 'merge',
          data: { items: [] },
          fieldVersion: 1,
          generatedBy: 'story-sync-agent',
        },
      ],
      { runId: 'r', chapterId: 'c', fieldVersions: { foreshadow_registry: 5 } },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.patches).toEqual([]);
  });

  it('rejects malformed (non-object) patch entry', () => {
    const r = parseStorySyncPatches(
      [null],
      { runId: 'r', chapterId: 'c', fieldVersions: {} },
    );
    expect(r.ok).toBe(false);
  });
});
