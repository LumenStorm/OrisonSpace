import type { ReusableAgentNodeContract } from '@orison/shared-contracts';
import type { NodeRunInput, NodeRunResult } from '../contracts/run';

export type OrchestrationNode = {
  id: string;
  contract?: ReusableAgentNodeContract;
  run(input: NodeRunInput): Promise<NodeRunResult>;
};

function createSimpleNode(
  id: string,
  stateKey: string,
  valueFactory: (requirement: string) => unknown,
  contract?: Omit<ReusableAgentNodeContract, 'nodeId' | 'producedArtifactKeys'> & {
    producedArtifactKeys?: string[];
  }
): OrchestrationNode {
  return {
    id,
    contract: {
      nodeId: id,
      displayName: contract?.displayName ?? id,
      inputSchemaName: contract?.inputSchemaName ?? 'nodeRunInput',
      outputSchemaName: contract?.outputSchemaName ?? stateKey,
      requiredArtifactKeys: contract?.requiredArtifactKeys ?? [],
      producedArtifactKeys: contract?.producedArtifactKeys ?? [stateKey],
      sideEffects: contract?.sideEffects ?? [],
    },
    async run(input) {
      return {
        stateKey,
        artifact: valueFactory(input.requirement)
      };
    }
  };
}

export const createIntakeNode = () =>
  createSimpleNode('intake-agent', 'intake.requirement', (requirement) => ({ requirement }), {
    displayName: 'Intake Agent',
    inputSchemaName: 'rawRequirement',
    outputSchemaName: 'creativeBriefSchema',
  });

export const createAssetLoaderNode = () =>
  createSimpleNode('asset-loader-agent', 'assets.projectContext', () => ({ styleGuide: 'default' }), {
    displayName: 'Asset Loader Agent',
    inputSchemaName: 'creativeBriefSchema',
    outputSchemaName: 'assetLoaderOutputSchema',
    requiredArtifactKeys: ['intake.requirement'],
  });

export const createStoryPlannerNode = () =>
  createSimpleNode('story-planner-agent', 'planning.storyPlan', (requirement) => ({ summary: `Plan for: ${requirement}` }), {
    displayName: 'Story Planner Agent',
    inputSchemaName: 'fullNovelPlanningContext',
    outputSchemaName: 'outlineV2Schema',
    requiredArtifactKeys: ['intake.requirement', 'assets.projectContext'],
  });

export const createChapterTaskNode = () =>
  createSimpleNode('chapter-task-agent', 'planning.chapterTasks', () => [{ id: 'chapter_1', goal: 'Open the story.' }], {
    displayName: 'Chapter Task Agent',
    inputSchemaName: 'outlineV2Schema',
    outputSchemaName: 'episodeOutlinesSchema',
    requiredArtifactKeys: ['planning.storyPlan'],
  });

export const createDraftWriterNode = () =>
  createSimpleNode('draft-writer-agent', 'draft.initial', () => ({ text: 'Initial draft output.' }));

export const createContinuityNode = () =>
  createSimpleNode('continuity-memory-agent', 'memory.continuity', () => ({ rules: ['keep tone consistent'] }));

export const createTargetedRevisionNode = () =>
  createSimpleNode('targeted-revision-agent', 'draft.revision', () => ({ text: 'Revised draft output.' }));

export { createContextLoaderNode } from './context-loader-agent';
export { createChapterBridgeNode } from './chapter-bridge-agent';
export { createChapterTitleNode } from './chapter-title-agent';
export { createStorySyncNode } from './story-sync-agent';
export { createMemoryExtractorNode } from './memory-extractor-agent';
