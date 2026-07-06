import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeSkill } from './normalize';
import type { NormalizedSkill, SkillWorkflowMode } from '../types';

interface ManifestSkillShape {
  name: string;
  description?: string;
  prompt?: string;
  workflowMode?: SkillWorkflowMode;
  entry?: string;
  references?: string[];
  scripts?: string[];
  assets?: string[];
  allowedTools?: string[];
  visibility?: 'visible' | 'hidden';
  permission?: 'readonly' | 'suggest' | 'auto';
}

export async function loadManifestSkill(manifestPath: string): Promise<NormalizedSkill> {
  const raw = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw) as ManifestSkillShape;
  const skillDir = path.dirname(manifestPath);

  return normalizeSkill({
    format: 'manifest',
    name: manifest.name,
    description: manifest.description,
    location: skillDir,
    entryPath: path.join(skillDir, manifest.entry ?? 'SKILL.md'),
    prompt: manifest.prompt ?? '',
    workflowMode: manifest.workflowMode ?? 'prompt',
    references: manifest.references ?? [],
    scripts: manifest.scripts ?? [],
    assets: manifest.assets ?? [],
    allowedTools: manifest.allowedTools,
    visibility: manifest.visibility,
    permission: manifest.permission,
  });
}
