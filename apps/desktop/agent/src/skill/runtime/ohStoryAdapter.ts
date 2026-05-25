import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NormalizedSkill, WorkflowDefinition } from '../types';
import { loadDirectorySkill } from './directoryAdapter';
import type { ExecutionPlan, ExecutionNode } from './executionPlan';

const ROUTABLE_SKILLS = new Set([
  'story',
  'story-long-write',
  'story-short-write',
  'story-long-analyze',
  'story-short-analyze',
  'story-deslop',
  'story-review',
]);

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

  return {
    ...plan,
    nodes: plan.nodes.map((node) => adaptCompiledNode(node, skillName)),
  };
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
