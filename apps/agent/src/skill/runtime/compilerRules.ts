export interface PhaseSection {
  id: string;
  title: string;
  content: string;
}

export interface ReferenceLink {
  label: string;
  path: string;
}

export interface SkillCall {
  skillName: string;
}

export interface AgentCall {
  agentType: string;
  prompt?: string;
}

export function extractPhaseSections(raw: string): PhaseSection[] {
  const normalized = raw.replace(/\r\n/g, '\n');
  const matches = [...normalized.matchAll(/^(?:##\s*)?Phase\s+(\d+)(?:[:：]\s*(.+))?$/gim)];
  if (matches.length === 0) {
    return [{
      id: 'phase-1',
      title: 'Phase 1',
      content: normalized.trim(),
    }];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1]?.index ?? normalized.length) : normalized.length;
    const full = normalized.slice(start, end).trim();
    const phaseNumber = match[1];
    const phaseLabel = match[2]?.trim();
    return {
      id: `phase-${phaseNumber}`,
      title: phaseLabel ? `Phase ${phaseNumber}: ${phaseLabel}` : `Phase ${phaseNumber}`,
      content: full,
    };
  });
}

export function extractReferenceLinks(raw: string): ReferenceLink[] {
  return [...raw.matchAll(/\[([^\]]+)\]\((references\/[^)]+)\)/g)].map((match) => ({
    label: match[1] ?? '',
    path: match[2] ?? '',
  }));
}

export function extractSkillCalls(raw: string): SkillCall[] {
  return [...raw.matchAll(/Skill\("([^"]+)"\)/g)].map((match) => ({
    skillName: match[1] ?? '',
  }));
}

export function extractAskUserMarkers(raw: string): string[] {
  return [...raw.matchAll(/AskUserQuestion/g)].map(() => 'AskUserQuestion');
}

export function extractAgentCalls(raw: string): AgentCall[] {
  const directCalls = [...raw.matchAll(/Agent\(\s*subagent_type:\s*"([^"]+)"(?:,\s*prompt:\s*"([\s\S]*?)")?\s*\)/g)].map((match) => ({
    agentType: match[1] ?? '',
    prompt: match[2],
  }));

  const sectionDeclaredCalls = [...raw.matchAll(
    /\*\*Agent\s+\d+\s*:\s*([^*（(]+?)\*\*[\s\S]{0,120}?[（(]\s*subagent_type:\s*([^)）\s]+)\s*[)）]/g,
  )].map((match) => ({
    agentType: (match[2] ?? match[1] ?? '').trim(),
  }));

  const byType = new Map<string, AgentCall>();
  for (const agent of [...directCalls, ...sectionDeclaredCalls]) {
    if (!agent.agentType) continue;
    if (!byType.has(agent.agentType)) {
      byType.set(agent.agentType, agent);
    }
  }
  return [...byType.values()];
}
