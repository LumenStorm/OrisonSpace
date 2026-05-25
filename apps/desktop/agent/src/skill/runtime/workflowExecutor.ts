import type { ChildStreamEvent, PendingConfirmationState } from '../../types';
import type { NormalizedSkill, WorkflowStep } from '../types';
import type { SkillRuntimeContext } from '../../context/builder';
import { SkillRegistry } from './registry';
import { createSkillRunState, type PendingSkillUserAction, type SkillRunState } from '../../runtime/skillRunState';
import { isOhStoryRouterPrompt, resolveOhStoryRoute } from './ohStoryAdapter';
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
  emitChildEvent?: (event: ChildStreamEvent) => void;
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
      const skill = requireSkill(options.registry, skillName);
      const outputs: string[] = [];
      const checkpoints: string[] = [];
      const pendingConfirmations: PendingConfirmationState[] = [];
      const nested: Array<{ skill: string; status: 'completed' }> = [];
      const priorRunState = context.skillContext?.skillRunState?.skill === skill.name
        ? context.skillContext.skillRunState
        : undefined;

      if (skill.name === 'story' && skill.workflow?.steps?.length === 1) {
        const promptStep = skill.workflow.steps[0];
        if (promptStep?.type === 'prompt' && isOhStoryRouterPrompt(promptStep.content)) {
          const routedSkill = resolveOhStoryRoute(context.input);
          const nestedResult = await this.executeSkill(routedSkill, context);
          outputs.push(...nestedResult.outputs);
          checkpoints.push(...nestedResult.checkpoints);
          pendingConfirmations.push(...nestedResult.pendingConfirmations);
          nested.push({ skill: routedSkill, status: nestedResult.status });
          return {
            skill: skill.name,
            status: 'completed',
            outputs,
            checkpoints,
            pendingConfirmations,
            nested,
            skillRunState: createSkillRunState({
              skill: skill.name,
              completedNodeIds: skill.workflow.steps.map((step) => step.id),
              loadedReferenceKeys: nestedResult.skillRunState?.loadedReferenceKeys ?? [],
              resolvedReferences: nestedResult.skillRunState?.resolvedReferences ?? context.skillContext?.resolvedReferences ?? [],
              referenceCache: nestedResult.skillRunState?.referenceCache ?? context.skillContext?.referenceCache,
            }),
          };
        }
      }

      if (skill.compiledPlan && !(skill.name === 'story' && skill.workflow?.steps?.length)) {
        const completedNodeIds = new Set(priorRunState?.completedNodeIds ?? []);
        let currentNodeId: string | undefined = priorRunState?.currentNodeId ?? skill.compiledPlan.entryNodeId;
        let pendingUserAction: PendingSkillUserAction | undefined;
        let canExecute = !currentNodeId;

        if (priorRunState?.pendingUserAction && context.input?.trim()) {
          completedNodeIds.add(priorRunState.pendingUserAction.nodeId);
          currentNodeId = undefined;
          canExecute = true;
        }

        for (const node of skill.compiledPlan.nodes) {
          if (completedNodeIds.has(node.id)) {
            continue;
          }
          if (!canExecute) {
            if (node.id !== currentNodeId) {
              continue;
            }
            canExecute = true;
          }

          await executeCompiledNode(node, skill, context, {
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

          if (node.type === 'ask_user') {
            pendingUserAction = {
              type: 'ask_user',
              nodeId: node.id,
              question: node.question,
              choices: node.choices,
              createdAt: Date.now(),
            };
            currentNodeId = node.id;
            break;
          }

          completedNodeIds.add(node.id);
          currentNodeId = undefined;
        }

        const skillRunState = createSkillRunState({
          skill: skill.name,
          currentNodeId,
          completedNodeIds: [...completedNodeIds],
          pendingUserAction,
          loadedReferenceKeys: context.skillContext?.resolvedReferences.map((item) => item.key) ?? [],
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
      for (const step of steps) {
        switch (step.type) {
          case 'prompt': {
            outputs.push(await options.executePrompt(step.content, skill, context));
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
            const nestedSkill = requireSkill(options.registry, step.skill);
            const nestedResult = await this.executeSkill(nestedSkill.name, context);
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
          loadedReferenceKeys: context.skillContext?.resolvedReferences.map((item) => item.key) ?? [],
          resolvedReferences: context.skillContext?.resolvedReferences ?? [],
          referenceCache: context.skillContext?.referenceCache,
        }),
      };
    },
  };
}

function requireSkill(registry: SkillRegistry, skillName: string): NormalizedSkill {
  const skill = registry.get(skillName);
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
    default:
      throw new Error(`compiled workflow node "${node.type}" is not supported yet`);
  }
}
