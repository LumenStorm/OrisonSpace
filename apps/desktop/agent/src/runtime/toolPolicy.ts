import type { ToolDefinition } from '../types';

export type SessionPermissionMode = 'readonly' | 'suggest' | 'auto';
export type ToolClass = 'read' | 'write' | 'diff' | 'dangerous';

const MODE_RANK: Record<SessionPermissionMode, number> = {
  readonly: 0,
  suggest: 1,
  auto: 2,
};

const ACTIVE_SKILL_SYSTEM_TOOLS = new Set([
  'skill',
  'skill_resource_list',
  'skill_resource_read',
]);

const WRITE_TOOLS = new Set([
  'write_file',
  'chapter_write',
  'memory_update',
  'generate_image',
  'edit_image',
  'git_commit',
]);

const DIFF_TOOLS = new Set([
  'rewrite_passage',
  'outline_update',
  'overview_update',
]);

export function classifyTool(toolName: string): ToolClass {
  if (toolName === 'git_commit') return 'dangerous';
  if (WRITE_TOOLS.has(toolName)) return 'write';
  if (DIFF_TOOLS.has(toolName)) return 'diff';
  return 'read';
}

export function filterToolsForPolicy(input: {
  tools: ToolDefinition[];
  sessionMode?: SessionPermissionMode;
  activeSkillAllowedTools?: string[];
  activeSkillPermission?: SessionPermissionMode;
}): ToolDefinition[] {
  return input.tools.filter((tool) => {
    try {
      assertToolAllowed({
        toolName: tool.id,
        sessionMode: input.sessionMode,
        activeSkillAllowedTools: input.activeSkillAllowedTools,
        activeSkillPermission: input.activeSkillPermission,
      });
      return true;
    } catch {
      return false;
    }
  });
}

export function assertToolAllowed(input: {
  toolName: string;
  sessionMode?: SessionPermissionMode;
  activeSkillAllowedTools?: string[];
  activeSkillPermission?: SessionPermissionMode;
}): void {
  const mode = stricterMode(input.sessionMode ?? 'suggest', input.activeSkillPermission);
  const allowedTools = input.activeSkillAllowedTools;
  if (
    allowedTools &&
    !allowedTools.includes(input.toolName) &&
    !ACTIVE_SKILL_SYSTEM_TOOLS.has(input.toolName)
  ) {
    throw new Error(`tool "${input.toolName}" is not allowed by active skill`);
  }

  const klass = classifyTool(input.toolName);
  if (mode === 'readonly' && (klass === 'write' || klass === 'diff' || klass === 'dangerous')) {
    throw new Error(`tool "${input.toolName}" is not allowed in readonly mode`);
  }

  if (mode === 'suggest' && klass === 'write') {
    throw new Error(`tool "${input.toolName}" requires auto mode`);
  }

  if (mode === 'suggest' && klass === 'dangerous') {
    throw new Error(`tool "${input.toolName}" requires auto mode`);
  }
}

function stricterMode(sessionMode: SessionPermissionMode, skillPermission?: SessionPermissionMode): SessionPermissionMode {
  if (!skillPermission) return sessionMode;
  return MODE_RANK[skillPermission] < MODE_RANK[sessionMode] ? skillPermission : sessionMode;
}
