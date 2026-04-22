import { describe, expect, it } from 'vitest';
import {
  applyPatchOperations,
  createEmptyProjectDocument
} from '../sync/localProjectRepository';

describe('local project repository helpers', () => {
  it('creates an empty local project document with story, script, and storyboard roots', () => {
    const project = createEmptyProjectDocument('Orison Demo');

    expect(project.meta.name).toBe('Orison Demo');
    expect(project.story.acts).toEqual([]);
    expect(project.script.scenes).toEqual([]);
    expect(project.storyboard.shots).toEqual([]);
  });

  it('applies a replace patch to the first story act summary', () => {
    const project = {
      meta: { id: 'project_1', name: 'Demo', version: 1 },
      story: { title: 'Demo', acts: [{ id: 'act_1', title: 'Arrival', summary: 'Old value' }] },
      script: { scenes: [] },
      storyboard: { shots: [] }
    };

    const updated = applyPatchOperations(project, [
      {
        op: 'replace',
        path: 'story.acts[0].summary',
        value: 'New value'
      }
    ]);

    expect(updated.story.acts[0].summary).toBe('New value');
  });
});
