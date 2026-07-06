import path from 'node:path';
import type { NormalizedSkill, SkillFormat, SkillWorkflowMode } from '../types';

export interface NormalizeSkillInput {
  format: SkillFormat;
  name: string;
  description?: string;
  location: string;
  entryPath: string;
  prompt: string;
  workflowMode?: SkillWorkflowMode;
  references?: string[];
  scripts?: string[];
  assets?: string[];
  priority?: 'required' | 'optional';
  allowedTools?: string[];
  visibility?: 'visible' | 'hidden';
  permission?: 'readonly' | 'suggest' | 'auto';
}

export function normalizeSkill(input: NormalizeSkillInput): NormalizedSkill {
  return {
    format: input.format,
    name: input.name,
    description: input.description,
    location: input.location,
    entryPath: input.entryPath,
    prompt: input.prompt.trim(),
    workflowMode: input.workflowMode ?? 'prompt',
    assets: {
      references: normalizePaths(input.location, input.references ?? []),
      scripts: normalizePaths(input.location, input.scripts ?? []),
      assets: normalizePaths(input.location, input.assets ?? []),
    },
    priority: input.priority,
    allowedTools: input.allowedTools,
    visibility: input.visibility,
    permission: input.permission,
  };
}

function normalizePaths(basePath: string, values: string[]): string[] {
  return values.map((value) => path.isAbsolute(value) ? value : path.join(basePath, value));
}
