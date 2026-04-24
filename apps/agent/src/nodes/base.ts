import type { NodeRunInput, NodeRunResult } from '../contracts/run';

export type OrchestrationNode = {
  id: string;
  run(input: NodeRunInput): Promise<NodeRunResult>;
};

function createSimpleNode(id: string, stateKey: string, valueFactory: (requirement: string) => unknown): OrchestrationNode {
  return {
    id,
    async run(input) {
      return {
        stateKey,
        artifact: valueFactory(input.requirement)
      };
    }
  };
}

export const createIntakeNode = () =>
  createSimpleNode('intake-agent', 'intake.requirement', (requirement) => ({ requirement }));

export const createAssetLoaderNode = () =>
  createSimpleNode('asset-loader-agent', 'assets.projectContext', () => ({ styleGuide: 'default' }));

export const createStoryPlannerNode = () =>
  createSimpleNode('story-planner-agent', 'planning.storyPlan', (requirement) => ({ summary: `Plan for: ${requirement}` }));

export const createChapterTaskNode = () =>
  createSimpleNode('chapter-task-agent', 'planning.chapterTasks', () => [{ id: 'chapter_1', goal: 'Open the story.' }]);

export const createDraftWriterNode = () =>
  createSimpleNode('draft-writer-agent', 'draft.initial', () => ({ text: 'Initial draft output.' }));

export const createContinuityNode = () =>
  createSimpleNode('continuity-memory-agent', 'memory.continuity', () => ({ rules: ['keep tone consistent'] }));

export const createTargetedRevisionNode = () =>
  createSimpleNode('targeted-revision-agent', 'draft.revision', () => ({ text: 'Revised draft output.' }));
