import type { ReusableAgentNodeContract } from '@orison/shared-contracts';
import type { NodeRunInput } from '../contracts/run';
import { creativeFieldKeys } from '@orison/shared-contracts';

interface NodeResult {
  stateKey: string;
  artifact: unknown;
}

interface AgentNode {
  contract: ReusableAgentNodeContract | null;
  run(input: NodeRunInput): Promise<NodeResult>;
}

const FORESHADOW_CUES = ['钥匙', '预言', '信物', '暗号', '密码', '线索', '伏笔'];

export function createStorySyncNode(): AgentNode {
  return {
    contract: {
      nodeId: 'story-sync-agent',
      displayName: 'Story Sync Agent',
      inputSchemaName: 'storySyncInput',
      outputSchemaName: 'storySyncOutput',
      requiredArtifactKeys: ['chapter.candidate'],
      producedArtifactKeys: ['story.sync'],
      sideEffects: ['apply_patch'],
    },
    async run(input: NodeRunInput): Promise<NodeResult> {
      const { run } = input;
      const candidate = run.artifacts['chapter.candidate'] as any;
      const context = run.artifacts['context.chapterContext'] as any;

      if (!candidate) {
        return {
          stateKey: 'story.sync',
          artifact: {
            runId: run.runId,
            chapterId: context?.chapterId ?? '',
            summary: 'skip: no chapter candidate',
            patches: [],
          },
        };
      }

      const chapterId = candidate.chapterId ?? context?.chapterId ?? '';
      const content = candidate.content ?? '';
      const foreshadowRegistry = context?.foreshadowRegistry ?? { items: [], version: 0 };
      const existingTitles = new Set((foreshadowRegistry.items ?? []).map((i: any) => i.title));

      const patches: any[] = [];
      for (const cue of FORESHADOW_CUES) {
        if (content.includes(cue) && !existingTitles.has(cue)) {
          patches.push({
            field: 'foreshadow_registry',
            action: 'merge',
            data: { title: cue, content: `${cue} detected in chapter`, status: 'pending' },
            fieldVersion: foreshadowRegistry.version ?? 0,
            generatedBy: 'story-sync-agent',
          });
        }
      }

      return {
        stateKey: 'story.sync',
        artifact: {
          runId: run.runId,
          chapterId,
          summary: `${patches.length} patches from rules`,
          patches,
        },
      };
    },
  };
}

export function createMemoryExtractorNode(): AgentNode {
  return {
    contract: {
      nodeId: 'memory-extractor-agent',
      displayName: 'Memory Extractor Agent',
      inputSchemaName: 'memoryExtractorInput',
      outputSchemaName: 'memoryExtractorOutput',
      requiredArtifactKeys: ['chapter.candidate'],
      producedArtifactKeys: ['memory.extracted'],
      sideEffects: [],
    },
    async run(input: NodeRunInput): Promise<NodeResult> {
      const { run } = input;
      const candidate = run.artifacts['chapter.candidate'] as any;
      const context = run.artifacts['context.chapterContext'] as any;

      const chapterId = candidate?.chapterId ?? context?.chapterId ?? '';
      const entries: any[] = [];

      if (candidate?.content) {
        entries.push({
          id: `mem_${Date.now().toString(36)}`,
          novelId: run.projectPath ?? 'unknown',
          chapterId,
          chapterNumber: context?.chapterNumber ?? 0,
          memoryType: 'event',
          title: candidate.title ?? 'untitled',
          content: candidate.summary || candidate.content.slice(0, 100),
          importanceScore: 0.5,
        });
      }

      return {
        stateKey: 'memory.extracted',
        artifact: { runId: run.runId, chapterId, entries },
      };
    },
  };
}

export function createAssetLoaderNode(): AgentNode {
  return {
    contract: {
      nodeId: 'asset-loader-agent',
      displayName: 'Asset Loader Agent',
      inputSchemaName: 'assetLoaderInput',
      outputSchemaName: 'assetLoaderOutput',
      requiredArtifactKeys: [],
      producedArtifactKeys: ['assets.projectContext'],
      sideEffects: ['persist_artifact'],
    },
    async run(): Promise<NodeResult> {
      return { stateKey: 'assets.projectContext', artifact: {} };
    },
  };
}

export function createStoryPlannerNode(): AgentNode {
  return {
    contract: {
      nodeId: 'story-planner-agent',
      displayName: 'Story Planner Agent',
      inputSchemaName: 'storyPlannerInput',
      outputSchemaName: 'outlineV2Schema',
      requiredArtifactKeys: ['creative_brief'],
      producedArtifactKeys: ['planning.storyPlan'],
      sideEffects: ['persist_artifact'],
    },
    async run(): Promise<NodeResult> {
      return { stateKey: 'planning.storyPlan', artifact: {} };
    },
  };
}

export function createChapterTaskNode(): AgentNode {
  return {
    contract: {
      nodeId: 'chapter-task-agent',
      displayName: 'Chapter Task Agent',
      inputSchemaName: 'chapterTaskInput',
      outputSchemaName: 'chapterTaskOutput',
      requiredArtifactKeys: ['planning.storyPlan'],
      producedArtifactKeys: ['chapter_tasks'],
      sideEffects: [],
    },
    async run(): Promise<NodeResult> {
      return { stateKey: 'chapter_tasks', artifact: [] };
    },
  };
}

export { runNovelPipeline } from '../engine/novelPipeline';
