/**
 * Legacy adapter retained only for migration reference.
 *
 * Standard skill loading no longer imports this file. Authored SKILL.md names
 * and native skill loading are the source of truth.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NormalizedSkill, WorkflowDefinition } from '../types';
import { loadDirectorySkill } from './directoryAdapter';
import type { ExecutionEdge, ExecutionPlan, ExecutionNode } from './executionPlan';

const ROUTABLE_SKILLS = new Set([
  'story',
  'story-write',
  'story-analyze',
  'story-review',
  'story-revise',
  'story-import',
  'story-outline',
  'story-intake',
  'story-memory-sync',
  'story-package',
]);

const SKILLS_WITH_WIZARD = new Set(['story-write']);

const ROUTER_SKILL = 'story';
const ROUTER_PROMPT_PREFIX = '__orison_oh_story_router__';

const BLOCKED_SKILLS = new Set([
  'story-setup',
  'story-long-scan',
  'story-short-scan',
  'browser-cdp',
]);

/**
 * Three-state classification of an oh-story skill directory.
 * - `loaded`: adapted skill ready to list + register.
 * - `blocked`: explicitly blocked (e.g. story-setup, *-scan, browser-cdp) — must
 *   be skipped entirely by both listing and execution so it neither appears in the
 *   prompt nor gets registered under its raw directory name.
 * - `not-applicable`: not an oh-story routable skill — caller should fall through
 *   to the standard directory/manifest loaders.
 */
export type OhStoryClassification =
  | { kind: 'loaded'; skill: NormalizedSkill }
  | { kind: 'blocked' }
  | { kind: 'not-applicable' };

export async function classifyOhStorySkill(skillDir: string): Promise<OhStoryClassification> {
  if (!existsSync(path.join(skillDir, 'SKILL.md'))) return { kind: 'not-applicable' };
  const skill = await loadDirectorySkill(skillDir);
  if (BLOCKED_SKILLS.has(skill.name)) return { kind: 'blocked' };
  if (!ROUTABLE_SKILLS.has(skill.name)) return { kind: 'not-applicable' };
  const shouldAdaptCompiledPlan = isOhStorySkillDirectory(skillDir);

  if (skill.name === ROUTER_SKILL) {
    return {
      kind: 'loaded',
      skill: {
        ...skill,
        format: 'manifest',
        workflowMode: 'workflow',
        prompt: ROUTER_PROMPT_PREFIX,
        workflow: buildRouterWorkflow(skill.name),
      },
    };
  }

  return {
    kind: 'loaded',
    skill: {
      ...skill,
      format: 'manifest',
      workflowMode: 'workflow',
      prompt: buildExecutionPrompt(skill.prompt, skill.name),
      compiledPlan: shouldAdaptCompiledPlan
        ? adaptCompiledPlan(skill.compiledPlan, skill.name)
        : skill.compiledPlan,
    },
  };
}

/** Backward-compatible wrapper. Treats `blocked` the same as `not-applicable` (null). */
async function _loadOhStoryCompatibleSkill(skillDir: string): Promise<NormalizedSkill | null> {
  const result = await classifyOhStorySkill(skillDir);
  return result.kind === 'loaded' ? result.skill : null;
}

function buildRouterWorkflow(skillName: string): WorkflowDefinition {
  return {
    steps: [
      {
        id: `${skillName}:route`,
        type: 'prompt',
        content: ROUTER_PROMPT_PREFIX,
      },
    ],
  };
}

function buildExecutionPrompt(originalPrompt: string, skillName: string): string {
  return [
    `You are executing the adapted external skill "${skillName}".`,
    'Follow the external story-skill guidance below as a creative writing assistant inside the Orison runtime.',
    '',
    '## Runtime Adaptation Rules',
    '',
    '### Tool Mapping (MUST follow)',
    '- To write chapters: use `chapter_write` tool (NOT write_file to 正文/ directory)',
    '- To read previous chapters: use `chapter_read` tool',
    '- To list chapters: use `chapter_list` tool',
    '- To update outline: use `outline_update` tool (NOT write_file to 大纲/ directory)',
    '- To read outline: use `outline_read` tool',
    '- To write settings/worldbuilding: use `write_file` with hierarchical subdirectory structure',
    '- To read settings: use `read_file` (check project file tree for actual paths)',
    '- To search content across files (grep/find替代): use `search` tool',
    '- To verify file exists after writing: use `list_files` on the target directory',
    '- Git operations: use `git_diff`, `git_status`, `git_log`, `git_commit` tools directly',
    '',
    '### Directory Mapping',
    '- If project.yaml has "directories" config, use those names instead of defaults.',
    '- Skill says `正文/` → use chapter_write/chapter_read APIs instead',
    '- Skill says `设定/` or `设定/角色/` → use actual settings directory from project file tree (e.g., `设定集/`)',
    '- Skill says `大纲/大纲.md` → use outline_update API for main outline',
    '- Skill says `大纲/细纲_第XXX章.md` or `大纲/卷纲_*.md` → use write_file (these are supplementary files)',
    '- Skill says `追踪/` → use write_file to 追踪/ directory (tracking files)',
    '',
    '### Agent References (no sub-agents available)',
    '- When skill says "spawn Agent(story-explorer...)" → perform the context loading yourself inline',
    '- When skill says "spawn Agent(story-architect...)" → perform the analysis yourself inline',
    '- When skill says "spawn Agent(character-designer...)" → design characters yourself inline',
    '- When skill says "spawn Agent(story-researcher...)" → use your knowledge directly',
    '- Do NOT mention agents to the user or ask them to spawn agents',
    '',
    '### Multi-agent Review Degradation (story-review)',
    '- When skill requires parallel multi-perspective review: perform reviews SEQUENTIALLY',
    '  from each perspective (consistency → character → narrative → style), keeping analysis separate.',
    '- For cascade/cross-chapter checks: use `chapter_list` to enumerate, then `chapter_read` to',
    '  read relevant chapters, and `search` tool to find cross-references and contradictions.',
    '- For diff-based review: use `git_diff` tool to see recent changes.',
    '',
    '### Unsupported Features (skip silently)',
    '- Bash/shell commands (wc, grep, curl) → estimate word count from string length, use `search` tool for grep',
    '- Hooks (session-start, pre-compact, etc.) → not available, skip',
    '- Browser/CDP operations → not available, skip',
    '- TodoWrite/TodoRead → not available, skip',
    '',
    '### Settings File Structure (MUST follow)',
    '- Use hierarchical subdirectories. ONE focused topic per file, under 150 lines.',
    '  Example: 设定集/角色/萧锋.md, 设定集/世界观/天下大势.md, 设定集/系统/核心机制.md',
    '- Before writing chapters, READ relevant settings files from the project file tree.',
    '',
    '---',
    '',
    originalPrompt.trim(),
  ].join('\n');
}

function adaptCompiledPlan(plan: ExecutionPlan | undefined, skillName: string): ExecutionPlan | undefined {
  if (!plan) return plan;

  const adaptedNodes = plan.nodes.map((node) => adaptCompiledNode(node, skillName));
  const adaptedEdges = [...plan.edges];

  if (SKILLS_WITH_WIZARD.has(skillName)) {
    return injectBookWizard(adaptedNodes, adaptedEdges, plan.entryNodeId);
  }

  return { ...plan, nodes: adaptedNodes, edges: adaptedEdges };
}

function adaptCompiledNode(node: ExecutionNode, skillName: string): ExecutionNode {
  if (node.type !== 'instruction') return node;
  return {
    ...node,
    content: buildExecutionPrompt(node.content, skillName),
  };
}

function isOhStorySkillDirectory(skillDir: string): boolean {
  // 统一用正斜杠比较，兼容 Windows 反斜杠路径与 *nix 正斜杠路径。
  const normalized = skillDir.replace(/\\/g, '/').toLowerCase();
  return normalized.includes('/oh-story-claudecode-main/skills/');
}

export function isOhStoryRouterPrompt(prompt: string): boolean {
  return prompt.trim() === ROUTER_PROMPT_PREFIX;
}

export function resolveOhStoryRoute(input?: string): string {
  const normalized = (input ?? '').trim();
  if (!normalized) return 'story-write';

  if (matchesAny(normalized, ['去ai', '去 AI', '去味', '太 ai', '太 AI', 'deslop'])) {
    return 'story-revise';
  }

  if (matchesAny(normalized, ['review', '审稿', '评审', '复盘'])) {
    return 'story-review';
  }

  const wantsAnalyze = matchesAny(normalized, ['拆', '分析', '解析', '黄金三章']);
  if (wantsAnalyze) {
    return 'story-analyze';
  }

  return 'story-write';
}

function matchesAny(input: string, keywords: string[]): boolean {
  const lowered = input.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

const BOOK_WIZARD_STEPS: Array<{ id: string; question: string; choices: string[] }> = [
  {
    id: 'wizard:genre',
    question: '题材方向',
    choices: ['都市重生', '修仙玄幻', '诡异悬疑', '游戏异界', '科幻未来', '历史架空'],
  },
  {
    id: 'wizard:style',
    question: '风格偏好',
    choices: ['快节奏连续打脸', '慢热铺垫后爆发', '轻松搞笑', '暗黑严肃', '热血燃向'],
  },
  {
    id: 'wizard:chapters',
    question: '章数规划',
    choices: ['30章（约10万字）', '50章（约17万字）', '80章（约28万字）', '100章+（约35万字）'],
  },
  {
    id: 'wizard:wordcount',
    question: '每章字数',
    choices: ['2000字', '3000字', '3500字', '4000字', '5000字'],
  },
  {
    id: 'wizard:extra',
    question: '补充信息（主角名、核心设定、对标作品等，可直接输入或回复"跳过"）',
    choices: [],
  },
];

function injectBookWizard(nodes: ExecutionNode[], edges: ExecutionEdge[], originalEntryId: string): ExecutionPlan {
  const wizardNodes: ExecutionNode[] = BOOK_WIZARD_STEPS.map((step) => ({
    id: step.id,
    type: 'ask_user' as const,
    question: step.question,
    choices: step.choices.length > 0 ? step.choices : undefined,
  }));

  // Chain wizard nodes together, then connect last wizard node to original entry
  const wizardEdges: ExecutionEdge[] = [];
  for (let i = 0; i < wizardNodes.length - 1; i++) {
    wizardEdges.push({ from: wizardNodes[i].id, to: wizardNodes[i + 1].id });
  }
  wizardEdges.push({ from: wizardNodes[wizardNodes.length - 1].id, to: originalEntryId });

  return {
    entryNodeId: wizardNodes[0].id,
    nodes: [...wizardNodes, ...nodes],
    edges: [...wizardEdges, ...edges],
  };
}
