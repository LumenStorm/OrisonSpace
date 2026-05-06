import { describe, expect, it } from 'vitest';
import { enforcePatchSafety } from '../src/safety';

describe('enforcePatchSafety', () => {
  it('keeps a clean merge patch and forces generatedBy', () => {
    const result = enforcePatchSafety(
      [
        {
          field: 'foreshadow_registry',
          action: 'merge',
          data: { items: [{ id: 'fs_1' }] },
          fieldVersion: 3,
          generatedBy: 'IMPERSONATOR',
        },
      ],
      {
        runId: 'run_1',
        chapterId: 'ch_1',
        fieldVersions: { foreshadow_registry: 3 },
      },
    );
    expect(result.patches).toHaveLength(1);
    expect(result.patches[0].generatedBy).toBe('story-sync-agent');
    expect(result.warnings).toEqual([]);
  });

  it('drops patches whose field is not in the creative-field whitelist', () => {
    const result = enforcePatchSafety(
      [
        {
          field: 'NOT_A_FIELD',
          action: 'merge',
          data: {},
          fieldVersion: 0,
          generatedBy: 'story-sync-agent',
        },
      ],
      { runId: 'r', chapterId: 'c', fieldVersions: {} },
    );
    expect(result.patches).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toMatch(/not a creative field/);
  });

  it('drops patches whose action is not merge', () => {
    const result = enforcePatchSafety(
      [
        {
          field: 'foreshadow_registry',
          action: 'set',
          data: {},
          fieldVersion: 0,
          generatedBy: 'story-sync-agent',
        },
      ],
      { runId: 'r', chapterId: 'c', fieldVersions: { foreshadow_registry: 0 } },
    );
    expect(result.patches).toEqual([]);
    expect(result.warnings[0].reason).toMatch(/not 'merge'/);
  });

  it('drops patches whose fieldVersion does not match recorded version', () => {
    const result = enforcePatchSafety(
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
    expect(result.patches).toEqual([]);
    expect(result.warnings[0].reason).toMatch(/does not match expected/);
  });

  it('rejects non-object patches gracefully', () => {
    const result = enforcePatchSafety([null, 7, 'patch'], {
      runId: 'r',
      chapterId: 'c',
      fieldVersions: {},
    });
    expect(result.patches).toEqual([]);
    expect(result.warnings).toHaveLength(3);
  });
});
