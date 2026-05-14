import type { PendingConfirmationState } from '../../types';
import type { NormalizedSkill, WorkflowStep } from '../types';
import type { SkillRuntimeContext } from '../../context/builder';
import { SkillRegistry } from './registry';

export interface WorkflowExecutionContext {
  sessionId: string;
  input?: string;
  skillContext?: SkillRuntimeContext;
}

export interface WorkflowExecutionResult {
  skill: string;
  status: 'completed';
  outputs: string[];
  checkpoints: string[];
  pendingConfirmations: PendingConfirmationState[];
  nested: Array<{ skill: string; status: 'completed' }>;
}

export interface WorkflowExecutorOptions {
  registry: SkillRegistry;
  executePrompt: (prompt: string, skill: NormalizedSkill, context: WorkflowExecutionContext) => Promise<string>;
  executeTool: (toolName: string, input: unknown, context: WorkflowExecutionContext) => Promise<string>;
  requestConfirmation: (toolName: string, input: unknown, context: WorkflowExecutionContext) => Promise<{
    approved: boolean;
    pending: PendingConfirmationState;
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
