import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function renderPrompt(
  templatePath: string,
  vars: Record<string, string>,
): Promise<string> {
  const raw = await readFile(templatePath, 'utf-8');
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

export function buildSystemPrompt(opts: {
  orisonPrompt: string;
  projectMeta?: string;
  skillsSummary?: string;
  toolDescriptions: string;
}): string {
  const parts = [opts.orisonPrompt];
  if (opts.projectMeta) parts.push(opts.projectMeta);
  if (opts.skillsSummary) parts.push(opts.skillsSummary);
  parts.push(`\n# Available Tools\n\n${opts.toolDescriptions}`);
  return parts.join('\n\n');
}
