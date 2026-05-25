import type { ExecutionPlan } from './executionPlan';

export type PrimitiveNodeType =
  | 'instruction'
  | 'load_reference'
  | 'run_script'
  | 'delegate_skill'
  | 'ask_user'
  | 'spawn_agent'
  | 'read_artifact'
  | 'write_artifact'
  | 'checkpoint'
  | 'branch'
  | 'finish';

export interface CompileWarning {
  code: string;
  message: string;
  nodeId?: string;
}

export interface CompiledSkill {
  id: string;
  name: string;
  source: 'directory' | 'manifest';
  entryPath: string;
  location: string;
  description?: string;
  rawPrompt: string;
  references: string[];
  scripts: string[];
  capabilities: string[];
  compiledPlan: ExecutionPlan;
  warnings: CompileWarning[];
}

export function isPrimitiveNodeType(value: string): value is PrimitiveNodeType {
  return value === 'instruction'
    || value === 'load_reference'
    || value === 'run_script'
    || value === 'delegate_skill'
    || value === 'ask_user'
    || value === 'spawn_agent'
    || value === 'read_artifact'
    || value === 'write_artifact'
    || value === 'checkpoint'
    || value === 'branch'
    || value === 'finish';
}
