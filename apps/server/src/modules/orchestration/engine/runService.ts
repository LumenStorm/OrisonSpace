import crypto from 'node:crypto';
import { orchestrationRunSchema } from '@orison/shared-contracts';
import { createNodeRegistry } from './registry';
import { executePythonNodeWithTimeout } from './pythonNodeExecutor';
import { routeReview } from './reviewRouter';
import { createArchiveRecord } from './archiveService';
import { buildDeliveryOutput } from './deliveryService';
import { buildFeedback } from './feedbackService';
import { runStore } from '../store/runStore';
import type { RunSnapshot, StartRunCommand } from '../contracts/run';

export function createRunService(options?: { reviewMode?: 'pass' | 'revise' | 'escalate'; forcePythonFailure?: boolean }) {
  const reviewMode = options?.reviewMode ?? 'pass';
  const forcePythonFailure = options?.forcePythonFailure ?? false;

  return {
    async start(command: StartRunCommand): Promise<RunSnapshot> {
      const nodes = createNodeRegistry(reviewMode);
      let run = orchestrationRunSchema.parse({
        runId: `run_${crypto.randomUUID()}`,
        status: 'pending',
        currentNodeId: null,
        projectPath: command.projectPath,
        completedNodes: [],
        pendingNodes: nodes.map((node) => node.id),
        artifacts: {},
        review: null,
        archive: null,
        delivery: null,
        feedback: null
      });

      for (const node of nodes) {
        if (run.status === 'revision_pending' || run.status === 'human_in_loop') break;

        run = {
          ...run,
          status: 'running',
          currentNodeId: node.id
        };

        let result;
        try {
          result = await executePythonNodeWithTimeout(
            {
              pythonCommand: 'python',
              runnerPath: 'python-agent/runner/main.py',
              request: {
                runId: run.runId,
                nodeId: node.id,
                nodeFile: forcePythonFailure && node.id === 'story-planner-agent'
                  ? 'python-agent/nodes/missing_story_planner_agent.py'
                  : node.config.entry,
                configFile: command.configRoot ?? `project-config/agents/${node.id}.yaml`,
                projectPath: command.projectPath,
                config: node.config,
                prompt: node.prompt,
                input: {
                  requirement: command.requirement,
                  artifacts: run.artifacts,
                  reviewMode
                }
              }
            },
            node.config.execution.timeoutMs
          );
        } catch (error) {
          run = {
            ...run,
            status: 'human_in_loop',
            currentNodeId: node.id,
            review: {
              verdict: 'escalate',
              summary: `python node failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              reasons: ['python_runner_failure']
            }
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
              reasons: [result.error.type]
            }
          };
          break;
        }

        run = {
          ...run,
          artifacts: {
            ...run.artifacts,
            [result.state_key ?? result.stateKey]: result.artifact
          },
          completedNodes: [...run.completedNodes, node.id],
          pendingNodes: run.pendingNodes.filter((id) => id !== node.id)
        };

        if (result.review) {
          const route = routeReview(result.review.verdict);
          run = {
            ...run,
            status: route.status,
            currentNodeId: route.currentNodeId,
            review: result.review
          };
        }
      }

      if (run.status === 'running' || run.status === 'pending') {
        run = {
          ...run,
          status: 'approved',
          currentNodeId: null
        };

        // 归档 → 交付 → 数据回流
        const archive = createArchiveRecord(run);
        const delivery = buildDeliveryOutput(run);
        const feedback = buildFeedback(run);
        run = {
          ...run,
          status: 'delivered',
          archive,
          delivery,
          feedback
        };
      }

      runStore.save(run);
      return run;
    },
    async get(runId: string) {
      const run = runStore.get(runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      return run;
    }
  };
}
