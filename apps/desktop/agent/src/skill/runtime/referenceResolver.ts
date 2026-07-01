import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface ResolvedReferencePayload {
  key: string;
  path: string;
  mode: 'full' | 'excerpt' | 'summary';
  content: string;
}

export interface LoadReferenceInput {
  skillDir: string;
  referencePath: string;
  mode: 'full' | 'excerpt' | 'summary';
  maxLines?: number;
  cache?: Map<string, ResolvedReferencePayload>;
}

export function resolveReferencePath(skillDir: string, referencePath: string): string {
  return path.isAbsolute(referencePath)
    ? referencePath
    : path.join(skillDir, referencePath);
}

export async function loadReference(input: LoadReferenceInput): Promise<ResolvedReferencePayload> {
  const absolutePath = resolveReferencePath(input.skillDir, input.referencePath);
  const key = `${absolutePath}:${input.mode}:${input.maxLines ?? ''}`;
  const cached = input.cache?.get(key);
  if (cached) {
    return cached;
  }

  const raw = await readFile(absolutePath, 'utf-8');
  const payload: ResolvedReferencePayload = {
    key,
    path: absolutePath,
    mode: input.mode,
    content: buildReferencePayload(raw, input.mode, input.maxLines),
  };
  input.cache?.set(key, payload);
  return payload;
}

function buildReferencePayload(
  raw: string,
  mode: 'full' | 'excerpt' | 'summary',
  maxLines = 3,
): string {
  if (mode === 'full') {
    return raw;
  }

  const lines = raw.split(/\r?\n/);
  const meaningfulLines = lines.filter((line) => line.trim().length > 0);
  if (mode === 'excerpt') {
    return meaningfulLines.slice(0, maxLines).join('\n');
  }

  return meaningfulLines.slice(0, Math.max(2, maxLines)).join('\n').trim();
}
