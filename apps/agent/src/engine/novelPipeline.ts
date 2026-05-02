import crypto from 'node:crypto';
import { orchestrationRunSchema } from '@orison/shared-contracts';
import type { RunSnapshot } from '../contracts/run';
import type { RegistryNode } from './registry';
import { createNovelNodeRegistry } from './registry';
import { executePythonNodeWithTimeout } from './pythonNodeExecutor';
import { routeReview } from './reviewRouter';
import { createArchiveRecord } from './archiveService';
import { buildDeliveryOutput } from './deliveryService';
import { buildFeedback } from './feedbackService';
import { runStore } from '../store/runStore';
import type { OrchestrationNode } from '../nodes/base';

interface NovelPipelineNode {
  id: string;
  runtime: 'typescript' | 'python';
  tsNode?: OrchestrationNode;
  pythonNode?: RegistryNode;
}

/**
 * 小说章节流水线：混合 TypeScript 节点（上下文加载、桥接、标题）
 * 和 Python 节点（草稿写作、评审、修订）。
 */
export async function runNovelPipeline(params: {
  projectPath: string;
  chapterId: string;
  mode: 'generate' | 'continue' | 'polish' | 'review';
  instruction?: string;
  reviewMode?: 'pass' | 'revise' | 'escalate';
  forcePythonFailure?: boolean;
}): Promise<RunSnapshot> {
  const { projectPath, chapterId, mode, instruction, reviewMode = 'pass', forcePythonFailure = false } = params;

  // 构建节点注册表
  const { tsNodes, pythonNodes } = createNovelNodeRegistry(chapterId, projectPath, reviewMode);

  const allNodes: NovelPipelineNode[] = [
    // TS 节点
    { id: 'context-loader-agent', runtime: 'typescript', tsNode: tsNodes.contextLoader },
    { id: 'chapter-bridge-agent', runtime: 'typescript', tsNode: tsNodes.chapterBridge },
    // Python 节点
    ...pythonNodes.map((pn) => ({ id: pn.id, runtime: 'python' as const, pythonNode: pn })),
    // TS 节点（后处理）
    { id: 'chapter-title-agent', runtime: 'typescript', tsNode: tsNodes.chapterTitle },
    { id: 'story-sync-agent', runtime: 'typescript', tsNode: tsNodes.storySync },
    { id: 'memory-extractor-agent', runtime: 'typescript', tsNode: tsNodes.memoryExtractor },
  ];

  const runId = `run_novel_${crypto.randomUUID()}`;

  let run: RunSnapshot = orchestrationRunSchema.parse({
    runId,
    status: 'pending',
    currentNodeId: null,
    projectPath,
    completedNodes: [],
    pendingNodes: allNodes.map((n) => n.id),
    artifacts: {},
    review: null,
    archive: null,
    delivery: null,
    feedback: null,
  });

  for (const node of allNodes) {
    if (run.status === 'revision_pending' || run.status === 'human_in_loop') break;

    run = {
      ...run,
      status: 'running',
      currentNodeId: node.id,
    };

    if (node.runtime === 'typescript' && node.tsNode) {
      // ── TypeScript 节点执行 ──
      const result = await node.tsNode.run({
        run,
        requirement: instruction ?? `Mode: ${mode}, Chapter: ${chapterId}`,
      });

      run = {
        ...run,
        artifacts: {
          ...run.artifacts,
          [result.stateKey]: result.artifact,
        },
        completedNodes: [...run.completedNodes, node.id],
        pendingNodes: run.pendingNodes.filter((id) => id !== node.id),
      };

      if (result.review) {
        const route = routeReview(result.review.verdict);
        run = { ...run, status: route.status, currentNodeId: route.currentNodeId, review: result.review };
      }
    } else if (node.runtime === 'python' && node.pythonNode) {
      // ── Python 节点执行 ──
      const pn = node.pythonNode;
      let result;
      try {
        result = await executePythonNodeWithTimeout(
          {
            pythonCommand: 'python',
            runnerPath: 'python/runner/main.py',
            request: {
              runId: run.runId,
              nodeId: node.id,
              nodeFile: forcePythonFailure && node.id === 'draft-writer-agent'
                ? 'python/nodes/missing_draft_writer_agent.py'
                : pn.config.entry,
              configFile: `prompts/${node.id}.yaml`,
              projectPath,
              config: pn.config,
              prompt: pn.prompt,
              input: {
                requirement: instruction ?? `Chapter: ${chapterId}, Mode: ${mode}`,
                artifacts: run.artifacts,
                reviewMode,
              },
            },
          },
          pn.config.execution.timeoutMs
        );
      } catch (error) {
        run = {
          ...run,
          status: 'human_in_loop',
          currentNodeId: node.id,
          review: {
            verdict: 'escalate',
            summary: `python node failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            reasons: ['python_runner_failure'],
          },
        };
        break;
      }

      if (!result.ok) {
        run = {
          ...run,
          status: result.error.retryable ? 'failed' : 'human_in_loop',
          currentNodeId: node.id,
          review: {
            verdict: 'escalate',
            summary: `python node failed: ${result.error.message}`,
            reasons: [result.error.type],
          },
        };
        break;
      }

      const stateKey = result.state_key ?? result.stateKey;
      if (!stateKey) {
        throw new Error(`python node ${node.id} returned no state key`);
      }

      run = {
        ...run,
        artifacts: {
          ...run.artifacts,
          [stateKey]: result.artifact,
        },
        completedNodes: [...run.completedNodes, node.id],
        pendingNodes: run.pendingNodes.filter((id) => id !== node.id),
      };

      if (result.review) {
        const route = routeReview(result.review.verdict);
        run = { ...run, status: route.status, currentNodeId: route.currentNodeId, review: result.review };
      }
    }
  }

  // 流水线结束：归档 → 交付
  if (run.status === 'running' || run.status === 'pending') {
    run = {
      ...run,
      status: 'approved',
      currentNodeId: null,
    };

    const archive = createArchiveRecord(run);
    const delivery = buildDeliveryOutput(run);
    const feedback = buildFeedback(run);
    run = {
      ...run,
      status: 'delivered',
      archive,
      delivery,
      feedback,
    };
  }

  runStore.save(run);
  return run;
}
