import type { SkillInfo } from './types';

export function parseSkillFile(raw: string, location: string): SkillInfo | null {
  const normalized = raw.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return { name: extractName(location), content: normalized, location };
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  const name = extractField(frontmatter, 'name') ?? extractName(location);
  const description = extractDescription(frontmatter);
  const priority = extractPriority(frontmatter);
  const allowedTools = extractStringList(frontmatter, 'allowed-tools');
  const visibility = extractVisibility(frontmatter);
  const permission = extractPermission(frontmatter);

  return { name, description, content: body.trim(), location, priority, allowedTools, visibility, permission };
}

function extractField(fm: string, field: string): string | undefined {
  const match = fm.match(new RegExp(`^${field}:[^\\S\\r\\n]*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^["']|["']$/g, '');
}

function extractPriority(fm: string): 'required' | 'optional' | undefined {
  const raw = extractField(fm, 'priority')?.toLowerCase();
  if (raw === 'required' || raw === 'optional') return raw;
  return undefined;
}

function extractVisibility(fm: string): 'visible' | 'hidden' | undefined {
  const raw = extractField(fm, 'visibility')?.toLowerCase();
  if (raw === 'visible' || raw === 'hidden') return raw;
  return undefined;
}

function extractPermission(fm: string): 'readonly' | 'suggest' | 'auto' | undefined {
  const raw = extractField(fm, 'permission')?.toLowerCase();
  if (raw === 'readonly' || raw === 'suggest' || raw === 'auto') return raw;
  return undefined;
}

function extractStringList(fm: string, field: string): string[] | undefined {
  const inline = extractField(fm, field);
  if (inline) {
    if (inline.startsWith('[') && inline.endsWith(']')) {
      return inline
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
    return inline
      .split(',')
      .map((item) => item.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  const lines = fm.split('\n');
  const startIndex = lines.findIndex((line) => new RegExp(`^${field}:\\s*$`).test(line));
  if (startIndex < 0) return undefined;

  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!/^\s+-\s+/.test(line)) break;
    const value = line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, '');
    if (value) values.push(value);
  }
  return values.length > 0 ? values : undefined;
}

function extractDescription(fm: string): string | undefined {
  const lines = fm.split('\n');
  const startIndex = lines.findIndex((line) => /^description:\s*\|/.test(line));
  if (startIndex >= 0) {
    const blockLines: string[] = [];
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (!/^\s+/.test(line)) break;
      blockLines.push(line.replace(/^\s{2}/, ''));
    }
    return blockLines.join('\n').trim();
  }

  const blockMatch = fm.match(/^description:\s*\|\s*\n([\s\S]*?)(?=^\S|$)/m);
  if (blockMatch?.[1]) {
    return blockMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s{2}/, '').trimEnd())
      .filter((line, index, array) => !(index === array.length - 1 && line === ''))
      .join('\n')
      .trim();
  }
  return extractField(fm, 'description');
}

function extractName(location: string): string {
  const parts = location.split(/[/\\]/);
  const idx = parts.lastIndexOf('SKILL.md');
  return idx > 0 ? parts[idx - 1] : 'unknown';
}
