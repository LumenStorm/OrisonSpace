import type { SkillInfo } from './types';

export function parseSkillFile(raw: string, location: string): SkillInfo | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return { name: extractName(location), content: raw, location };
  }

  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  const name = extractField(frontmatter, 'name') ?? extractName(location);
  const description = extractDescription(frontmatter);

  return { name, description, content: body.trim(), location };
}

function extractField(fm: string, field: string): string | undefined {
  const match = fm.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^["']|["']$/g, '');
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

  const blockMatch = fm.match(/^description:\s*\|\s*\n([\s\S]*?)(?=^\S|\Z)/m);
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
