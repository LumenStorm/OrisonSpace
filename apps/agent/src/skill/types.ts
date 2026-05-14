export interface SkillInfo {
  name: string;
  description?: string;
  location: string;
  content: string;
}

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
}

export interface NormalizedSkill {
  format: SkillFormat;
  name: string;
  description?: string;
  location: string;
  entryPath: string;
  prompt: string;
  workflowMode: SkillWorkflowMode;
  assets: NormalizedSkillAssets;
  workflow?: WorkflowDefinition;
}
