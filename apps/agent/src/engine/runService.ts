import crypto from 'node:crypto';
import { orchestrationRunSchema } from '@orison/shared-contracts';
import type { CreativeRunRequest, CreativeRunContext } from '@orison/shared-contracts';
import { createNodeRegistry, createExtendedNodeRegistry } from './registry';
import { executePythonNodeWithTimeout } from './pythonNodeExecutor';
import { routeReview } from './reviewRouter';
import { createArchiveRecord } from './archiveService';
import { buildDeliveryOutput } from './deliveryService';
import { buildFeedback } from './feedbackService';
import { buildCreativeRunContext } from './contextBuilder';
import { writeArtifactYaml, buildContextPacket, writeContextPacketYaml } from './artifactYaml';
import { syncForeshadowRegistryFromEpisodes } from './foreshadowLedger';
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
              runnerPath: 'python/runner/main.py',
              request: {
                runId: run.runId,
                nodeId: node.id,
                nodeFile: forcePythonFailure && node.id === 'story-planner-agent'
                  ? 'python/nodes/missing_story_planner_agent.py'
                  : node.config.entry,
                configFile: command.configRoot ?? `prompts/${node.id}.yaml`,
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

        const stateKey = result.state_key ?? result.stateKey;
        if (!stateKey) {
          throw new Error(`python node ${node.id} returned no state key`);
        }

        run = {
          ...run,
          artifacts: {
            ...run.artifacts,
            [stateKey]: result.artifact
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
    },

    async startCreative(request: CreativeRunRequest): Promise<RunSnapshot> {
      const context = buildCreativeRunContext(request);
      const command: StartRunCommand = {
        projectPath: request.projectPath,
        requirement: request.requirement,
        configRoot: request.configRoot
      };
      const configRoot = command.configRoot ?? command.projectPath;

      const nodes = createExtendedNodeRegistry(reviewMode);
      let run = orchestrationRunSchema.parse({
        runId: context.runId,
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

        // 落盘：为当前节点写入瘦身上下文包
        if (node.contract) {
          const packet = buildContextPacket(node.contract, run.artifacts, context.fieldVersions, run.runId);
          try { writeContextPacketYaml(configRoot, run.runId, node.id, packet); } catch (err) { console.warn(`[${run.runId}] context-packet 落盘失败 (${node.id}):`, err); }
        }

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
              runnerPath: 'python/runner/main.py',
              request: {
                runId: run.runId,
                nodeId: node.id,
                nodeFile: forcePythonFailure && node.id === 'story-planner-agent'
                  ? 'python/nodes/missing_story_planner_agent.py'
                  : node.config.entry,
                configFile: command.configRoot ?? `prompts/${node.id}.yaml`,
                projectPath: command.projectPath,
                config: node.config,
                prompt: node.prompt,
                input: {
                  requirement: command.requirement,
                  artifacts: run.artifacts,
                  reviewMode,
                  context
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

        const stateKey = result.state_key ?? result.stateKey;
        if (!stateKey) {
          throw new Error(`python node ${node.id} returned no state key`);
        }
        let nextArtifacts: Record<string, unknown> = {
          ...run.artifacts,
          [stateKey]: result.artifact
        };
        let derivedForeshadowRegistry: unknown | null = null;

        if (stateKey === 'episode_outlines' && Array.isArray(result.artifact)) {
          const synced = syncForeshadowRegistryFromEpisodes({
            registry: nextArtifacts.foreshadow_registry ?? { items: [], version: 0, updatedBy: 'agent' },
            episodeOutlines: result.artifact as Array<{
              id: string;
              index: number;
              title?: string;
              foreshadowing?: string[];
              payoffs?: string[];
              status?: string;
            }>
          });
          derivedForeshadowRegistry = synced.registry;
          nextArtifacts = {
            ...nextArtifacts,
            foreshadow_registry: synced.registry
          };
        }

        run = {
          ...run,
          artifacts: nextArtifacts,
          completedNodes: [...run.completedNodes, node.id],
          pendingNodes: run.pendingNodes.filter((id) => id !== node.id)
        };

        // 落盘：将产物写入 YAML
        try {
          const fieldVersion = stateKey in context.fieldVersions
            ? context.fieldVersions[stateKey as keyof typeof context.fieldVersions] ?? 0
            : 0;
          writeArtifactYaml(configRoot, run.runId, stateKey, result.artifact, {
            schema_version: 1,
            field_version: fieldVersion,
            generated_by: node.id,
            source_refs: []
          });
          if (derivedForeshadowRegistry) {
            writeArtifactYaml(configRoot, run.runId, 'foreshadow_registry', derivedForeshadowRegistry, {
              schema_version: 1,
              field_version: context.fieldVersions.foreshadow_registry ?? 0,
              generated_by: node.id,
              source_refs: [`artifact:${stateKey}`]
            });
          }
        } catch (err) { console.warn(`[${run.runId}] artifact 落盘失败 (${node.id}):`, err); }

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
    }
  };
}
