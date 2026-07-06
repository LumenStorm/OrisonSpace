export interface SkillInfo {
  name: string;
  description?: string;
  location: string;
  content: string;
  priority?: 'required' | 'optional';
  allowedTools?: string[];
  visibility?: 'visible' | 'hidden';
  permission?: 'readonly' | 'suggest' | 'auto';
}

import type { ExecutionPlan } from './runtime/executionPlan';

export type SkillFormat = 'directory' | 'manifest';
export type SkillWorkflowMode = 'prompt' | 'inline' | 'workflow';

export type WorkflowStep =
  | { id: string; type: 'prompt'; content: string }
  | { id: string; type: 'tool'; toolName: string; input?: unknown }
  | { id: string; type: 'skill'; skill: string; input?: string }
  | { id: string; type: 'checkpoint'; label: string }
  | { id: string; type: 'confirm'; toolName: string; input?: unknown };

export interface WorkflowDefinition {
  steps: WorkflowStep[];
}

export interface NormalizedSkillAssets {
  references: string[];
  scripts: string[];
  assets?: string[];
}

export interface NormalizedSkill {
  format: SkillFormat;
  name: string;
  description?: string;
  location: string;
  source?: 'project' | 'external';
  entryPath: string;
  prompt: string;
  workflowMode: SkillWorkflowMode;
  assets: NormalizedSkillAssets;
  workflow?: WorkflowDefinition;
  compiledPlan?: ExecutionPlan;
  capabilities?: string[];
  rawSource?: string;
  priority?: 'required' | 'optional';
  allowedTools?: string[];
  visibility?: 'visible' | 'hidden';
  permission?: 'readonly' | 'suggest' | 'auto';
}
