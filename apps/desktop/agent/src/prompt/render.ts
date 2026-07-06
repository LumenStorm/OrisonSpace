export function buildSystemPrompt(opts: {
  orisonPrompt: string;
  projectMeta?: string;
  skillsSummary?: string;
  toolDescriptions?: string;
}): string {
  const parts = [opts.orisonPrompt];
  if (opts.projectMeta) parts.push(opts.projectMeta);
  if (opts.skillsSummary) parts.push(opts.skillsSummary);
  if (opts.toolDescriptions?.trim()) {
    parts.push(`\n# Available Tools\n\n${opts.toolDescriptions}`);
  }
  return parts.join('\n\n');
}

export function appendToolDescriptions(systemPrompt: string, tools: Array<{ id: string; description: string }>): string {
  const descriptions = tools.map((tool) => `- ${tool.id}: ${tool.description}`).join('\n');
  return `${systemPrompt}\n\n# Available Tools\n\n${descriptions || '(no tools available)'}`;
}
