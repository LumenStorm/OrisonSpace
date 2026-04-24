import { runStore } from '../store/runStore';
import { createArchiveRecord } from './archiveService';
import { buildDeliveryOutput } from './deliveryService';
import { buildFeedback } from './feedbackService';
import { createNodeRegistry } from './registry';
import { executePythonNodeWithTimeout } from './pythonNodeExecutor';
import { routeReview } from './reviewRouter';
import type { RunSnapshot } from '../contracts/run';

function finalizeRun(run: RunSnapshot): RunSnapshot {
  const archive = createArchiveRecord(run);
  const delivery = buildDeliveryOutput(run);
  const feedback = buildFeedback(run);

  const finalized: RunSnapshot = {
    ...run,
    status: 'delivered',
    archive,
    delivery,
    feedback
  };

  runStore.update(run.runId, finalized);
  return finalized;
}

export function createActionService() {
  return {
    async acceptCurrent(runId: string): Promise<RunSnapshot> {
      const run = runStore.get(runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      if (run.status !== 'human_in_loop' && run.status !== 'revision_pending') {
        throw new Error(`Run ${runId} is not awaiting action (status: ${run.status})`);
      }

      const approved = runStore.update(runId, {
        status: 'approved',
        currentNodeId: null
      });

      return finalizeRun(approved);
    },

    async editAndResume(runId: string, payload: Record<string, unknown>): Promise<RunSnapshot> {
      const run = runStore.get(runId);
      if (!run) throw new Error(`Run not found: ${runId}`);
      if (run.status !== 'human_in_loop' && run.status !== 'revision_pending') {
        throw new Error(`Run ${runId} is not awaiting action (status: ${run.status})`);
      }

      // 合并用户编辑到 artifacts
      const updatedArtifacts = { ...run.artifacts, ...payload };
      let updated = runStore.update(runId, {
        artifacts: updatedArtifacts,
        status: 'running',
        currentNodeId: run.currentNodeId
      });

      // 从当前节点之后继续执行
      const nodes = createNodeRegistry();
      const currentIdx = run.currentNodeId
        ? nodes.findIndex((n) => n.id === run.currentNodeId)
        : -1;
      const remaining = currentIdx >= 0 ? nodes.slice(currentIdx + 1) : [];

      for (const node of remaining) {
        if (updated.status === 'revision_pending' || updated.status === 'human_in_loop') break;

        updated = runStore.update(runId, { status: 'running', currentNodeId: node.id });

        let result;
        try {
          result = await executePythonNodeWithTimeout(
            {
              pythonCommand: 'python',
              runnerPath: 'python/runner/main.py',
              request: {
                runId: updated.runId,
                nodeId: node.id,
                nodeFile: node.config.entry,
                configFile: `project-config/agents/${node.id}.yaml`,
                projectPath: updated.projectPath,
                config: node.config,
                prompt: node.prompt,
                input: {
                  requirement: '',
                  artifacts: updated.artifacts,
                  reviewMode: 'pass'
                }
              }
            },
            node.config.execution.timeoutMs
          );
        } catch (error) {
          return runStore.update(runId, {
            status: 'human_in_loop',
            currentNodeId: node.id,
            review: {
              verdict: 'escalate',
              summary: `Node failed: ${error instanceof Error ? error.message : 'Unknown'}`,
              reasons: ['python_runner_failure']
            }
          });
        }

        if (!result.ok) {
          return runStore.update(runId, {
            status: 'human_in_loop',
            currentNodeId: node.id,
            review: {
              verdict: 'escalate',
              summary: `Node failed: ${result.error.message}`,
              reasons: [result.error.type]
            }
          });
        }

        updated = runStore.update(runId, {
          artifacts: { ...updated.artifacts, [result.state_key ?? result.stateKey]: result.artifact },
          completedNodes: [...updated.completedNodes, node.id],
          pendingNodes: updated.pendingNodes.filter((id) => id !== node.id)
        });

        if (result.review) {
          const route = routeReview(result.review.verdict);
          updated = runStore.update(runId, {
            status: route.status,
            currentNodeId: route.currentNodeId,
            review: result.review
          });
        }
      }

      if (updated.status === 'running' || updated.status === 'pending') {
        updated = runStore.update(runId, { status: 'approved', currentNodeId: null });
        return finalizeRun(updated);
      }

      return updated;
    },

    async rerunFromNode(runId: string, nodeId: string): Promise<RunSnapshot> {
      const run = runStore.get(runId);
      if (!run) throw new Error(`Run not found: ${runId}`);

      // 重置：从指定节点开始，清除后续节点的产物
      const nodes = createNodeRegistry();
      const startIdx = nodes.findIndex((n) => n.id === nodeId);
      if (startIdx < 0) throw new Error(`Node not found: ${nodeId}`);

      const nodesToRerun = nodes.slice(startIdx);
      const keysToRemove = new Set(nodesToRerun.map((n) => n.config.outputs.stateKey));
      const cleanedArtifacts = Object.fromEntries(
        Object.entries(run.artifacts).filter(([k]) => !keysToRemove.has(k))
      );

      let updated = runStore.update(runId, {
        status: 'running',
        currentNodeId: nodeId,
        artifacts: cleanedArtifacts,
        completedNodes: run.completedNodes.filter((id) => !nodesToRerun.some((n) => n.id === id)),
        pendingNodes: nodesToRerun.map((n) => n.id),
        review: null,
        archive: null,
        delivery: null,
        feedback: null
      });

      // 复用 editAndResume 的后续执行逻辑（从 startIdx 开始）
      for (const node of nodesToRerun) {
        if (updated.status === 'revision_pending' || updated.status === 'human_in_loop') break;

        updated = runStore.update(runId, { status: 'running', currentNodeId: node.id });

        let result;
        try {
          result = await executePythonNodeWithTimeout(
            {
              pythonCommand: 'python',
              runnerPath: 'python/runner/main.py',
              request: {
                runId: updated.runId,
                nodeId: node.id,
                nodeFile: node.config.entry,
                configFile: `project-config/agents/${node.id}.yaml`,
                projectPath: updated.projectPath,
                config: node.config,
                prompt: node.prompt,
                input: {
                  requirement: '',
                  artifacts: updated.artifacts,
                  reviewMode: 'pass'
                }
              }
            },
            node.config.execution.timeoutMs
          );
        } catch (error) {
          return runStore.update(runId, {
            status: 'human_in_loop',
            currentNodeId: node.id,
            review: {
              verdict: 'escalate',
              summary: `Node failed: ${error instanceof Error ? error.message : 'Unknown'}`,
              reasons: ['python_runner_failure']
            }
          });
        }

        if (!result.ok) {
          return runStore.update(runId, {
            status: 'human_in_loop',
            currentNodeId: node.id,
            review: {
              verdict: 'escalate',
              summary: `Node failed: ${result.error.message}`,
              reasons: [result.error.type]
            }
          });
        }

        updated = runStore.update(runId, {
          artifacts: { ...updated.artifacts, [result.state_key ?? result.stateKey]: result.artifact },
          completedNodes: [...updated.completedNodes, node.id],
          pendingNodes: updated.pendingNodes.filter((id) => id !== node.id)
        });

        if (result.review) {
          const route = routeReview(result.review.verdict);
          updated = runStore.update(runId, {
            status: route.status,
            currentNodeId: route.currentNodeId,
            review: result.review
          });
        }
      }

      if (updated.status === 'running' || updated.status === 'pending') {
        updated = runStore.update(runId, { status: 'approved', currentNodeId: null });
        return finalizeRun(updated);
      }

      return updated;
    },

    async abortRun(runId: string): Promise<RunSnapshot> {
      const run = runStore.get(runId);
      if (!run) throw new Error(`Run not found: ${runId}`);

      return runStore.update(runId, {
        status: 'failed',
        currentNodeId: null,
        review: {
          verdict: 'escalate',
          summary: '用户手动终止',
          reasons: ['user_abort']
        }
      });
    }
  };
}
