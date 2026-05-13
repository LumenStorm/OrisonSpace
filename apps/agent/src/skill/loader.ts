import type { SkillInfo } from './types';

export function parseSkillFile(raw: string, location: string): SkillInfo | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return { name: extractName(location), content: raw, location };
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  const name = extractField(frontmatter, 'name') ?? extractName(location);
  const description = extractField(frontmatter, 'description');

  return { name, description, content: body.trim(), location };
}

function extractField(fm: string, field: string): string | undefined {
  const match = fm.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^["']|["']$/g, '');
}

function extractName(location: string): string {
  const parts = location.split(/[/\\]/);
  const idx = parts.lastIndexOf('SKILL.md');
  return idx > 0 ? parts[idx - 1] : 'unknown';
}
