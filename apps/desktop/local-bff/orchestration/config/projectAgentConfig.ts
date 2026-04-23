export function resolveProjectAgentConfigRoot(projectPath: string) {
  return `${projectPath.replace(/[\\/]$/, '')}/project-config/agents`;
}
