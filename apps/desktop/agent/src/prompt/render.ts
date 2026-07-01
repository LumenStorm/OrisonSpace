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
