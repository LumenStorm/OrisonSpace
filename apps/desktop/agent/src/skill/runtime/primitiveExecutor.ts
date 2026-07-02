import { loadReference } from './referenceResolver';
import type { ExecutionNode } from './executionPlan';
import type { NormalizedSkill } from '../types';
import type { WorkflowExecutionContext, WorkflowExecutionResult } from './workflowExecutor';
import { logger } from '../../logger';

export interface PrimitiveExecutorOptions {
  executePrompt: (prompt: string, skill: NormalizedSkill, context: WorkflowExecutionContext) => Promise<string>;
  requestConfirmation: (toolName: string, input: unknown, context: WorkflowExecutionContext) => Promise<{
    approved: boolean;
    pending: WorkflowExecutionResult['pendingConfirmations'][number];
  }>;
  executeSkill: (skillName: string, context: WorkflowExecutionContext) => Promise<WorkflowExecutionResult>;
  dispatchAgent?: (agentType: string, prompt: string, context: WorkflowExecutionContext) => Promise<{
    content: string;
    status: 'completed';
  }>;
}

export interface PrimitiveExecutionAccumulator {
  outputs: string[];
  checkpoints: string[];
  pendingConfirmations: WorkflowExecutionResult['pendingConfirmations'];
  nested: WorkflowExecutionResult['nested'];
}

export async function executeInstructionNode(
  node: Extract<ExecutionNode, { type: 'instruction' }>,
  skill: NormalizedSkill,
  context: WorkflowExecutionContext,
  options: PrimitiveExecutorOptions,
  accumulator: PrimitiveExecutionAccumulator,
): Promise<void> {
  accumulator.outputs.push(await options.executePrompt(node.content, skill, context));
}

export async function executeLoadReferenceNode(
  node: Extract<ExecutionNode, { type: 'load_reference' }>,
  skill: NormalizedSkill,
  context: WorkflowExecutionContext,
  _accumulator: PrimitiveExecutionAccumulator,
): Promise<void> {
  const payload = await loadReference({
    skillDir: skill.location,
    referencePath: node.path,
    mode: node.mode,
    cache: context.skillContext?.referenceCache,
  });
  if (context.skillContext) {
    context.skillContext.resolvedReferences.push(payload);
  } else {
    logger.warn({ refPath: node.path, skill: skill.name }, 'load_reference: skillContext unavailable, reference discarded');
  }
}

export async function executeDelegateSkillNode(
  node: Extract<ExecutionNode, { type: 'delegate_skill' }>,
  context: WorkflowExecutionContext,
  options: PrimitiveExecutorOptions,
  accumulator: PrimitiveExecutionAccumulator,
): Promise<void> {
  const nestedContext: WorkflowExecutionContext = {
    ...context,
    input: node.input ?? context.input,
  };
  const nestedResult = await options.executeSkill(node.skillName, nestedContext);
  accumulator.outputs.push(...nestedResult.outputs);
  accumulator.checkpoints.push(...nestedResult.checkpoints);
  accumulator.pendingConfirmations.push(...nestedResult.pendingConfirmations);
  accumulator.nested.push({ skill: node.skillName, status: nestedResult.status });
}

export async function executeAskUserNode(
  node: Extract<ExecutionNode, { type: 'ask_user' }>,
  context: WorkflowExecutionContext,
  options: PrimitiveExecutorOptions,
  accumulator: PrimitiveExecutionAccumulator,
): Promise<void> {
  const confirmation = await options.requestConfirmation('ask_user', {
    question: node.question,
    choices: node.choices,
  }, context);
  accumulator.pendingConfirmations.push(confirmation.pending);
}

export async function executeSpawnAgentNode(
  node: Extract<ExecutionNode, { type: 'spawn_agent' }>,
  context: WorkflowExecutionContext,
  options: PrimitiveExecutorOptions,
  accumulator: PrimitiveExecutionAccumulator,
): Promise<void> {
  if (!options.dispatchAgent) {
    throw new Error('dispatchAgent is not configured');
  }
  const result = await options.dispatchAgent(node.agentType, node.prompt, context);
  accumulator.outputs.push(result.content);
  accumulator.nested.push({ skill: node.agentType, status: result.status });
}

export function executeCheckpointNode(
  node: Extract<ExecutionNode, { type: 'checkpoint' }>,
  accumulator: PrimitiveExecutionAccumulator,
): void {
  accumulator.checkpoints.push(node.label ?? node.id);
}
