import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NormalizedSkill, WorkflowDefinition } from '../types';
import { loadDirectorySkill } from './directoryAdapter';
import type { ExecutionEdge, ExecutionPlan, ExecutionNode } from './executionPlan';

const ROUTABLE_SKILLS = new Set([
  'story',
  'story-long-write',
  'story-short-write',
  'story-long-analyze',
  'story-short-analyze',
  'story-deslop',
  'story-review',
]);

const SKILLS_WITH_WIZARD = new Set(['story-long-write', 'story-short-write']);

const ROUTER_SKILL = 'story';
const ROUTER_PROMPT_PREFIX = '__orison_oh_story_router__';

export async function loadOhStoryCompatibleSkill(skillDir: string): Promise<NormalizedSkill | null> {
  if (!existsSync(path.join(skillDir, 'SKILL.md'))) return null;
  const skill = await loadDirectorySkill(skillDir);
  if (!ROUTABLE_SKILLS.has(skill.name)) return null;
  const shouldAdaptCompiledPlan = isOhStorySkillDirectory(skillDir);

  if (skill.name === ROUTER_SKILL) {
    return {
      ...skill,
      format: 'manifest',
      workflowMode: 'workflow',
      prompt: ROUTER_PROMPT_PREFIX,
      workflow: buildRouterWorkflow(skill.name),
    };
  }

  return {
    ...skill,
    format: 'manifest',
    workflowMode: 'workflow',
    prompt: buildExecutionPrompt(skill.prompt, skill.name),
    compiledPlan: shouldAdaptCompiledPlan
      ? adaptCompiledPlan(skill.compiledPlan, skill.name)
      : skill.compiledPlan,
  };
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
    'If the external skill mentions unsupported Claude-specific primitives, reinterpret them into direct assistant behavior instead of asking for unavailable platform actions.',
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
  const normalized = skillDir.replace(/\//g, '\\').toLowerCase();
  return normalized.includes('\\oh-story-claudecode-main\\skills\\');
}

export function isOhStoryRouterPrompt(prompt: string): boolean {
  return prompt.trim() === ROUTER_PROMPT_PREFIX;
}

export function resolveOhStoryRoute(input?: string): string {
  const normalized = (input ?? '').trim();
  if (!normalized) return 'story-long-write';

  if (matchesAny(normalized, ['去ai', '去 AI', '去味', '太 ai', '太 AI', 'deslop'])) {
    return 'story-deslop';
  }

  if (matchesAny(normalized, ['review', '审稿', '评审', '复盘'])) {
    return 'story-review';
  }

  const wantsAnalyze = matchesAny(normalized, ['拆', '分析', '解析', 'review', '黄金三章']);
  const wantsShort = matchesAny(normalized, ['短篇', '盐言', '一万字', '短故事']);
  if (wantsAnalyze && wantsShort) {
    return 'story-short-analyze';
  }
  if (wantsAnalyze) {
    return 'story-long-analyze';
  }

  if (wantsShort) {
    return 'story-short-write';
  }

  return 'story-long-write';
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
