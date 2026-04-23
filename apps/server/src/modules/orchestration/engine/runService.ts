import crypto from 'node:crypto';
import { orchestrationRunSchema } from '@orison/shared-contracts';
import { createNodeRegistry } from './registry';
import { routeReview } from './reviewRouter';
import { runStore } from '../store/runStore';
import type { RunSnapshot, StartRunCommand } from '../contracts/run';

export function createRunService(options?: { reviewMode?: 'pass' | 'revise' | 'escalate' }) {
  const reviewMode = options?.reviewMode ?? 'pass';

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
        archive: null
      });

      for (const node of nodes) {
        if (run.status === 'revision_pending' || run.status === 'human_in_loop') break;

        run = {
          ...run,
          status: 'running',
          currentNodeId: node.id
        };

        const result = await node.run({ run, requirement: command.requirement });
        run = {
          ...run,
          artifacts: {
            ...run.artifacts,
            [result.stateKey]: result.artifact
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
