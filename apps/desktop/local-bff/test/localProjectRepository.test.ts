import { describe, expect, it } from 'vitest';
import {
  applyPatchOperations,
  createEmptyProjectDocument
} from '../sync/localProjectRepository';

describe('local project repository helpers', () => {
  it('creates an empty local project document with outline and storyboard roots', () => {
    const project = createEmptyProjectDocument('Orison Demo');

    expect(project.meta.name).toBe('Orison Demo');
    expect(project.meta.type).toBe('novel');
    expect(project.outline.acts).toEqual([]);
    expect(project.storyboard.shots).toEqual([]);
  });

  it('applies a replace patch to the first outline act summary', () => {
    const now = new Date().toISOString();
    const project = createEmptyProjectDocument('Demo');
    const withAct = {
      ...project,
      outline: {
        ...project.outline,
        acts: [{ id: 'act_1', title: 'Arrival', summary: 'Old value' }]
      }
    };

    const updated = applyPatchOperations(withAct, [
      {
        op: 'replace',
        path: 'outline.acts[0].summary',
        value: 'New value'
      }
    ]);

    expect(updated.outline.acts[0].summary).toBe('New value');
  });
});
