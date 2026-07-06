import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface AgentDefinition {
  role: string;
  description?: string;
  model?: string;
  allowedTools?: string[];
  systemPrompt: string;
  location: string;
}

const SEARCH_DIRS = [
  ['.orison', 'agents'],
  ['.claude', 'agents'],
];

export interface LoadAgentDefinitionOptions {
  projectPath: string;
  role: string;
  extraRoots?: string[];
}

export async function loadAgentDefinition(opts: LoadAgentDefinitionOptions): Promise<AgentDefinition | null> {
  const candidates = buildCandidatePaths(opts);
  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, 'utf-8');
      return parseAgentDefinition(raw, opts.role, candidate);
    } catch (err) {
      if (isNotFound(err)) continue;
      throw err;
    }
  }
  return null;
}

function buildCandidatePaths({ projectPath, role, extraRoots = [] }: LoadAgentDefinitionOptions): string[] {
  const fileName = `${role}.md`;
  const candidates: string[] = [];
  for (const segments of SEARCH_DIRS) {
    candidates.push(path.join(projectPath, ...segments, fileName));
  }
  for (const root of extraRoots) {
    candidates.push(path.join(root, fileName));
  }
  return candidates;
}

function isNotFound(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as { code?: string }).code === 'ENOENT';
}

function parseAgentDefinition(raw: string, role: string, location: string): AgentDefinition {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { role, systemPrompt: raw.trim(), location };
  }
  const frontmatter = match[1];
  const body = match[2].trim();
  return {
    role,
    description: extractField(frontmatter, 'description'),
    model: extractField(frontmatter, 'model'),
    allowedTools: extractList(frontmatter, 'tools') ?? extractList(frontmatter, 'allowed_tools'),
    systemPrompt: body,
    location,
  };
}

function extractField(fm: string, field: string): string | undefined {
  const match = fm.match(new RegExp(`^${field}:[ \\t]*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^["']|["']$/g, '');
}

function extractList(fm: string, field: string): string[] | undefined {
  const inline = extractField(fm, field);
  if (inline) {
    if (inline.startsWith('[') && inline.endsWith(']')) {
      return inline.slice(1, -1).split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    return inline.split(',').map((item) => item.trim()).filter(Boolean);
  }
  const lines = fm.split('\n');
  const startIndex = lines.findIndex((line) => new RegExp(`^${field}:\\s*$`).test(line));
  if (startIndex < 0) return undefined;
  const list: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const itemMatch = line.match(/^\s+-\s+(.+)$/);
    if (!itemMatch) break;
    list.push(itemMatch[1].trim().replace(/^["']|["']$/g, ''));
  }
  return list.length ? list : undefined;
}
