/**
 * Legacy manifest workflow executor.
 *
 * Standard directory SKILL.md files are OpenCode-style prompt skills and must
 * not be compiled into this executor. Keep this only for explicit manifest
 * workflows until those are removed or redesigned.
 */
import type { ChildStreamEvent, PendingConfirmationState } from '../../types';
import { MAX_SPAWN_DEPTH, SpawnDepthExceededError } from '../../types';
import type { NormalizedSkill, WorkflowStep } from '../types';
import type { SkillRuntimeContext } from '../../context/builder';
import { SkillRegistry } from './registry';
import { createSkillRunState, type PendingSkillUserAction, type SkillRunState } from '../../runtime/skillRunState';
import {
  executeAskUserNode,
  executeCheckpointNode,
  executeDelegateSkillNode,
  executeInstructionNode,
  executeLoadReferenceNode,
  executeSpawnAgentNode,
} from './primitiveExecutor';
import type { ExecutionNode } from './executionPlan';

export interface WorkflowExecutionContext {
  sessionId: string;
  input?: string;
  skillContext?: SkillRuntimeContext;
  abort?: AbortSignal;
  spawnDepth?: number;
  /** Nesting depth of skill→skill delegation; guards against cyclic skill graphs. */
  skillDepth?: number;
  /** Registry scope used to resolve project-local hot-pluggable skills. */
  skillScope?: string;
  emitChildEvent?: (event: ChildStreamEvent) => void;
  suppressSpawnAgent?: boolean;
  suppressAllTools?: boolean;
  suppressWriteTools?: boolean;
}

export interface WorkflowExecutionResult {
  skill: string;
  status: 'completed';
  outputs: string[];
  checkpoints: string[];
  pendingConfirmations: PendingConfirmationState[];
  nested: Array<{ skill: string; status: 'completed' }>;
  skillRunState?: SkillRunState;
}

export interface WorkflowExecutorOptions {
  registry: SkillRegistry;
  executePrompt: (prompt: string, skill: NormalizedSkill, context: WorkflowExecutionContext) => Promise<string>;
  executeTool: (toolName: string, input: unknown, context: WorkflowExecutionContext) => Promise<string>;
  requestConfirmation: (toolName: string, input: unknown, context: WorkflowExecutionContext) => Promise<{
    approved: boolean;
    pending: PendingConfirmationState;
  }>;
  dispatchAgent?: (agentType: string, prompt: string, context: WorkflowExecutionContext) => Promise<{
    content: string;
    status: 'completed';
  }>;
}

export interface WorkflowExecutor {
  executeSkill(skillName: string, context: WorkflowExecutionContext): Promise<WorkflowExecutionResult>;
}

export function createWorkflowExecutor(options: WorkflowExecutorOptions): WorkflowExecutor {
  return {
    async executeSkill(skillName, context) {
      const skillDepth = context.skillDepth ?? 0;
      if (skillDepth > MAX_SPAWN_DEPTH) {
        throw new SpawnDepthExceededError(skillDepth);
      }
      // Context handed to any nested skill execution — one level deeper.
      const nestedSkillContext: WorkflowExecutionContext = { ...context, skillDepth: skillDepth + 1 };
      const skill = requireSkill(options.registry, skillName, context);
      const outputs: string[] = [];
      const checkpoints: string[] = [];
      const pendingConfirmations: PendingConfirmationState[] = [];
      const nested: Array<{ skill: string; status: 'completed' }> = [];
      const priorRunState = (() => {
        const raw = context.skillContext?.skillRunState?.skill === skill.name
          ? context.skillContext.skillRunState
          : undefined;
        if (!raw) return undefined;
        // 已完成的运行状态（无暂停点）不应阻止重新执行；视为全新调用。
        if (!raw.currentNodeId && !raw.pendingUserAction) return undefined;
        return raw;
      })();

      if (skill.compiledPlan && !(skill.name === 'story' && skill.workflow?.steps?.length)) {
        const completedNodeIds = new Set(priorRunState?.completedNodeIds ?? []);
        let currentNodeId: string | undefined = priorRunState?.currentNodeId ?? skill.compiledPlan.entryNodeId;
        let pendingUserAction: PendingSkillUserAction | undefined;
        let canExecute = !currentNodeId;
        const userResponses: Record<string, string> = { ...(priorRunState?.userResponses ?? {}) };

        if (priorRunState?.pendingUserAction && context.input?.trim()) {
          userResponses[priorRunState.pendingUserAction.nodeId] = context.input.trim();
          completedNodeIds.add(priorRunState.pendingUserAction.nodeId);
          currentNodeId = undefined;
          canExecute = true;
        }

        const isFirstExecution = !priorRunState || (priorRunState.completedNodeIds?.length ?? 0) === 0;

        for (let nodeIdx = 0; nodeIdx < skill.compiledPlan.nodes.length; nodeIdx++) {
          if (context.abort?.aborted) break;

          let node: ExecutionNode = skill.compiledPlan.nodes[nodeIdx];
          if (completedNodeIds.has(node.id)) {
            continue;
          }
          if (!canExecute) {
            if (node.id !== currentNodeId) {
              continue;
            }
            canExecute = true;
          }

          // On first execution, skip spawn_agent nodes — wait for user response first
          if (isFirstExecution && node.type === 'spawn_agent') {
            currentNodeId = node.id;
            break;
          }

          // ask_user nodes pause the workflow — handled inline to avoid the
          // double-fire that occurred when executeAskUserNode also pushed a
          // pendingConfirmation and the loop set pendingUserAction separately.
          if (node.type === 'ask_user') {
            pendingUserAction = {
              type: 'ask_user',
              nodeId: node.id,
              question: node.question,
              choices: node.choices,
              createdAt: Date.now(),
            };
            const confirmation = await options.requestConfirmation('ask_user', {
              question: node.question,
              choices: node.choices,
            }, nestedSkillContext);
            pendingConfirmations.push(confirmation.pending);
            currentNodeId = node.id;
            break;
          }

          // Inject accumulated userResponses into instruction prompt
          if (node.type === 'instruction' && Object.keys(userResponses).length > 0) {
            const responseSummary = formatUserResponses(userResponses, skill.compiledPlan.nodes);
            node = { ...node, content: `${node.content}\n\n${responseSummary}` };
          }

          // If the next *un-completed* node requires an explicit user answer, the
          // current prompt must not advance the workflow by calling tools on its own.
          const nextNode = skill.compiledPlan.nodes
            .slice(nodeIdx + 1)
            .find(n => !completedNodeIds.has(n.id));
          const hasFollowingSpawnAgent = node.type === 'instruction' &&
            skill.compiledPlan.nodes.slice(nodeIdx + 1).some((n) => !completedNodeIds.has(n.id) && n.type === 'spawn_agent');
          const suppressAllTools = node.type === 'instruction' && nextNode?.type === 'ask_user';
          const suppressSpawnAgent = node.type === 'instruction' &&
            (nextNode?.type === 'ask_user' || isFirstExecution);
          const suppressWriteTools = hasFollowingSpawnAgent;
          // Base on nestedSkillContext so any delegate_skill / skill recursion
          // through the node executor carries the incremented skillDepth guard.
          const execContext = (suppressAllTools || suppressSpawnAgent || suppressWriteTools)
            ? {
              ...nestedSkillContext,
              suppressAllTools,
              suppressSpawnAgent,
              suppressWriteTools,
            }
            : nestedSkillContext;

          await executeCompiledNode(node, skill, execContext, {
            executePrompt: options.executePrompt,
            requestConfirmation: options.requestConfirmation,
            executeSkill: this.executeSkill.bind(this),
            dispatchAgent: options.dispatchAgent,
          }, {
            outputs,
            checkpoints,
            pendingConfirmations,
            nested,
          });

          completedNodeIds.add(node.id);
          currentNodeId = undefined;
        }

        const skillRunState = createSkillRunState({
          skill: skill.name,
          currentNodeId,
          completedNodeIds: [...completedNodeIds],
          pendingUserAction,
          userResponses,
          loadedReferenceKeys: context.skillContext?.resolvedReferences?.map((item) => item.key) ?? [],
          resolvedReferences: context.skillContext?.resolvedReferences ?? priorRunState?.resolvedReferences ?? [],
          referenceCache: context.skillContext?.referenceCache ?? priorRunState?.referenceCache,
        });

        return {
          skill: skill.name,
          status: 'completed',
          outputs,
          checkpoints,
          pendingConfirmations,
          nested,
          skillRunState,
        };
      }

      const steps = skill.workflow?.steps ?? [{ id: `${skill.name}:prompt`, type: 'prompt', content: skill.prompt } satisfies WorkflowStep];
      // Suppress spawn_agent on first execution in prompt-based path too
      const promptContext = !priorRunState ? { ...context, suppressSpawnAgent: true } : context;
      for (const step of steps) {
        switch (step.type) {
          case 'prompt': {
            outputs.push(await options.executePrompt(step.content, skill, promptContext));
            break;
          }
          case 'tool': {
            outputs.push(await options.executeTool(step.toolName, step.input, context));
            break;
          }
          case 'checkpoint': {
            checkpoints.push(step.label);
            break;
          }
          case 'confirm': {
            const confirmation = await options.requestConfirmation(step.toolName, step.input, context);
            pendingConfirmations.push(confirmation.pending);
            break;
          }
          case 'skill': {
            const nestedSkill = requireSkill(options.registry, step.skill, nestedSkillContext);
            const nestedResult = await this.executeSkill(nestedSkill.name, nestedSkillContext);
            outputs.push(...nestedResult.outputs);
            checkpoints.push(...nestedResult.checkpoints);
            pendingConfirmations.push(...nestedResult.pendingConfirmations);
            nested.push({ skill: nestedSkill.name, status: nestedResult.status });
            break;
          }
        }
      }

      return {
        skill: skill.name,
        status: 'completed',
        outputs,
        checkpoints,
        pendingConfirmations,
        nested,
        skillRunState: createSkillRunState({
          skill: skill.name,
          completedNodeIds: steps.map((step) => step.id),
          loadedReferenceKeys: context.skillContext?.resolvedReferences?.map((item) => item.key) ?? [],
          resolvedReferences: context.skillContext?.resolvedReferences ?? [],
          referenceCache: context.skillContext?.referenceCache,
        }),
      };
    },
  };
}

function requireSkill(registry: SkillRegistry, skillName: string, context: WorkflowExecutionContext): NormalizedSkill {
  const skill = registry.get(skillName, context.skillScope);
  if (!skill) {
    throw new Error(`skill "${skillName}" not found`);
  }
  return skill;
}

async function executeCompiledNode(
  node: ExecutionNode,
  skill: NormalizedSkill,
  context: WorkflowExecutionContext,
  options: {
    executePrompt: WorkflowExecutorOptions['executePrompt'];
    requestConfirmation: WorkflowExecutorOptions['requestConfirmation'];
    executeSkill: (skillName: string, context: WorkflowExecutionContext) => Promise<WorkflowExecutionResult>;
    dispatchAgent?: WorkflowExecutorOptions['dispatchAgent'];
  },
  accumulator: {
    outputs: string[];
    checkpoints: string[];
    pendingConfirmations: PendingConfirmationState[];
    nested: Array<{ skill: string; status: 'completed' }>;
  },
): Promise<void> {
  switch (node.type) {
    case 'instruction':
      await executeInstructionNode(node, skill, context, options, accumulator);
      break;
    case 'load_reference':
      await executeLoadReferenceNode(node, skill, context, accumulator);
      break;
    case 'delegate_skill':
      await executeDelegateSkillNode(node, context, options, accumulator);
      break;
    case 'ask_user':
      await executeAskUserNode(node, context, options, accumulator);
      break;
    case 'spawn_agent':
      await executeSpawnAgentNode(node, context, options, accumulator);
      break;
    case 'checkpoint':
      executeCheckpointNode(node, accumulator);
      break;
    case 'finish':
      break;
    default: {
      const nodeType = (node as any).type;
      accumulator.outputs.push(`[${nodeType}] node is not yet implemented — skipped.`);
      break;
    }
  }
}

function formatUserResponses(responses: Record<string, string>, nodes: ExecutionNode[]): string {
  const lines: string[] = ['[用户已确认的设定]'];
  for (const [nodeId, answer] of Object.entries(responses)) {
    const node = nodes.find((n) => n.id === nodeId);
    const label = node?.type === 'ask_user' ? node.question : nodeId;
    lines.push(`- ${label}: ${answer}`);
  }
  return lines.join('\n');
}
