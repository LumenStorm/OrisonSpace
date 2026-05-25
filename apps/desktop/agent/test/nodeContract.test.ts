import { describe, expect, it } from 'vitest';
import {
  createAssetLoaderNode,
  createChapterTaskNode,
  createStoryPlannerNode,
  createStorySyncNode,
} from '../src/nodes/base';

describe('agent node reusable contracts', () => {
  it('exposes planning node metadata independent of a workflow runner', () => {
    const nodes = [createAssetLoaderNode(), createStoryPlannerNode(), createChapterTaskNode()];

    expect(nodes.map((node) => node.contract?.nodeId)).toEqual([
      'asset-loader-agent',
      'story-planner-agent',
      'chapter-task-agent',
    ]);
    expect(nodes[1].contract?.producedArtifactKeys).toContain('planning.storyPlan');
  });

  it('exposes story sync metadata for memory-sync workflows', () => {
    const node = createStorySyncNode();

    expect(node.contract?.nodeId).toBe('story-sync-agent');
    expect(node.contract?.requiredArtifactKeys).toContain('chapter.candidate');
    expect(node.contract?.producedArtifactKeys).toContain('story.sync');
  });
});
