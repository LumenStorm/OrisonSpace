import type { PythonNodeConfig } from '../contracts/pythonExecutor';
import type { AgentContract } from '@orison/shared-contracts';
import { getAgentContract } from './agentContracts';
import { createContextLoaderNode, createChapterBridgeNode, createChapterTitleNode, createStorySyncNode, createMemoryExtractorNode } from '../nodes/base';
import type { OrchestrationNode } from '../nodes/base';

export type PythonRegistryNode = {
  id: string;
  runtime: 'python';
  config: PythonNodeConfig;
  prompt: {
    system: string;
    user: string;
  };
  contract?: AgentContract;
};

export type RegistryNode = PythonRegistryNode;

function createPythonNode(
  id: string,
  entry: string,
  stateKey: string,
  artifactType: string,
  prompt: { system: string; user: string },
  reviewMode?: 'pass' | 'revise' | 'escalate',
  modelOverride?: string
): PythonRegistryNode {
  return {
    id,
    runtime: 'python',
    config: {
      agentId: id,
      runtime: 'python',
      entry,
      model: modelOverride ?? 'gpt-5.4',
      execution: {
        timeoutMs: 30000,
        maxRetries: 2
      },
      prompt: {
        file: `./prompts/${id}.yaml`,
        systemKey: 'system',
        userKey: 'user'
      },
      inputs: {
        fromState: [],
        mappings: {
          requirement: 'intake.requirement'
        }
      },
      outputs: {
        artifactType,
        stateKey
      },
      review: {
        passRules: reviewMode ? ['review_passes'] : [],
        escalateOn: reviewMode ? ['review_escalates'] : []
      }
    },
    prompt,
    contract: getAgentContract(id)
  };
}

export function createNodeRegistry(reviewMode: 'pass' | 'revise' | 'escalate' = 'pass', model?: string): RegistryNode[] {
  return [
    createPythonNode(
      'intake-agent',
      'python/nodes/intake_agent.py',
      'intake.requirement',
      'requirement',
      {
        system: 'You normalize user requirements.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    ),
    createPythonNode(
      'asset-loader-agent',
      'python/nodes/asset_loader_agent.py',
      'assets.projectContext',
      'project_context',
      {
        system: 'You load project assets.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    ),
    createPythonNode(
      'story-planner-agent',
      'python/nodes/story_planner_agent.py',
      'planning.storyPlan',
      'story_plan',
      {
        system: 'You are a story planner.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    ),
    createPythonNode(
      'chapter-task-agent',
      'python/nodes/chapter_task_agent.py',
      'planning.chapterTasks',
      'chapter_tasks',
      {
        system: 'You break plans into chapter tasks.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    ),
    createPythonNode(
      'draft-writer-agent',
      'python/nodes/draft_writer_agent.py',
      'draft.initial',
      'draft',
      {
        system: 'You write the first draft.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    ),
    createPythonNode(
      'continuity-memory-agent',
      'python/nodes/continuity_memory_agent.py',
      'memory.continuity',
      'continuity_memory',
      {
        system: 'You update continuity memory.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    ),
    createPythonNode(
      'multi-review-agent',
      'python/nodes/multi_review_agent.py',
      'review.latest',
      'review',
      {
        system: 'You review the generated content.',
        user: `Review mode: ${reviewMode}. Requirement: {{requirement}}`
      },
      reviewMode,
      model
    ),
    createPythonNode(
      'targeted-revision-agent',
      'python/nodes/targeted_revision_agent.py',
      'draft.revision',
      'draft_revision',
      {
        system: 'You revise the draft based on review feedback.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    )
  ];
}

/**
 * 扩展节点注册表，包含 Phase 1 新增的 curve-planner 和 episode-planner。
 * Python 节点文件尚未实现，暂不加入默认 pipeline。
 */
export function createExtendedNodeRegistry(reviewMode: 'pass' | 'revise' | 'escalate' = 'pass', model?: string): RegistryNode[] {
  const base = createNodeRegistry(reviewMode, model);
  const storyPlannerIdx = base.findIndex((n) => n.id === 'story-planner-agent');
  const insertIdx = storyPlannerIdx >= 0 ? storyPlannerIdx + 1 : base.length;

  const newNodes = [
    createPythonNode(
      'curve-planner-agent',
      'python/nodes/curve_planner_agent.py',
      'curves',
      'curves',
      {
        system: 'You generate growth, pacing, and emotion curves.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    ),
    createPythonNode(
      'episode-planner-agent',
      'python/nodes/episode_planner_agent.py',
      'episode_outlines',
      'episode_outlines',
      {
        system: 'You generate episode outlines.',
        user: 'Requirement: {{requirement}}'
      },
      undefined,
      model
    )
  ];

  return [...base.slice(0, insertIdx), ...newNodes, ...base.slice(insertIdx)];
}

/**
 * 小说章节流水线注册表：返回 TypeScript 节点和 Python 节点的混合配置。
 * TS 节点处理上下文加载、桥接和标题生成。
 * Python 节点处理 AI 驱动的草稿写作、评审和修订。
 */
export function createNovelNodeRegistry(
  chapterId: string,
  projectPath: string,
  reviewMode: 'pass' | 'revise' | 'escalate' = 'pass',
  model?: string
): {
  tsNodes: {
    contextLoader: OrchestrationNode;
    chapterBridge: OrchestrationNode;
    chapterTitle: OrchestrationNode;
    storySync: OrchestrationNode;
    memoryExtractor: OrchestrationNode;
  };
  pythonNodes: PythonRegistryNode[];
} {
  const tsNodes = {
    contextLoader: createContextLoaderNode(chapterId, projectPath),
    chapterBridge: createChapterBridgeNode(),
    chapterTitle: createChapterTitleNode(),
    storySync: createStorySyncNode(),
    memoryExtractor: createMemoryExtractorNode(),
  };

  const pythonNodes: PythonRegistryNode[] = [
    createPythonNode(
      'draft-writer-agent',
      'python/nodes/novel_draft_writer_agent.py',
      'draft.initial',
      'draft',
      {
        system: '你是一位小说作家，根据上下文撰写章节内容。',
        user: '请根据提供的上下文和桥接指南，撰写章节内容。{{requirement}}',
      },
      undefined,
      model
    ),
    createPythonNode(
      'multi-review-agent',
      'python/nodes/multi_review_agent.py',
      'review.latest',
      'review',
      {
        system: '你审查章节质量。',
        user: `Review mode: ${reviewMode}. {{requirement}}`,
      },
      reviewMode,
      model
    ),
    createPythonNode(
      'targeted-revision-agent',
      'python/nodes/targeted_revision_agent.py',
      'draft.revision',
      'draft_revision',
      {
        system: '你根据评审意见修订章节。',
        user: '{{requirement}}',
      },
      undefined,
      model
    ),
  ];

  return { tsNodes, pythonNodes };
}
