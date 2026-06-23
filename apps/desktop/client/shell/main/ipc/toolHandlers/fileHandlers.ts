/**
 * File tool handlers — read_file, write_file, list_files, search
 */
import { existsSync, readFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { assertWithinProject } from '../pathGuard';
import { notifyUI } from '../toolNotify';
import type { ToolHandler } from '../toolExecution';
import { atomicWriteFileSync } from '../../fs/atomicWrite';

export const readFileHandler: ToolHandler = async ({ params, projectDir }) => {
  const { filePath, offset = 0, limit } = params as { filePath: string; offset?: number; limit?: number };
  const fullPath = path.resolve(projectDir, filePath);
  assertWithinProject(projectDir, fullPath);
  if (!existsSync(fullPath)) throw new Error(`File not found: ${filePath}`);

  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const sliced = limit ? lines.slice(offset, offset + limit) : lines.slice(offset);
  const numbered = sliced.map((l, i) => `${offset + i + 1}\t${l}`).join('\n');

  return {
    title: filePath,
    output: numbered,
    metadata: { totalLines: lines.length, returned: sliced.length },
  };
};

export const writeFileHandler: ToolHandler = async ({ params, projectDir }) => {
  const { filePath, content } = params as { filePath: string; content: string };
  const fullPath = path.resolve(projectDir, filePath);
  assertWithinProject(projectDir, fullPath);

  const dir = path.dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Snapshot pre-write content for suggest-mode reject/restore (the write lands
  // now; review happens after). null marks a new file → reject deletes it.
  const existedBefore = existsSync(fullPath);
  const previousContent = existedBefore ? readFileSync(fullPath, 'utf-8') : null;

  atomicWriteFileSync(fullPath, content, 'utf-8');

  notifyUI({ type: 'file:changed', path: filePath });
  return {
    title: filePath,
    output: `Wrote ${content.length} chars to ${filePath}`,
    metadata: { previousContent, existedBefore },
  };
};

export const listFilesHandler: ToolHandler = async ({ params, projectDir }) => {
  const { dirPath = '.', recursive = false } = params as { dirPath?: string; recursive?: boolean };
  const fullPath = path.resolve(projectDir, dirPath);
  assertWithinProject(projectDir, fullPath);
  if (!existsSync(fullPath)) throw new Error(`Directory not found: ${dirPath}`);

  const results: string[] = [];
  function walk(dir: string, prefix: string) {
    const entries = readdirSync(dir);
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const fp = path.join(dir, name);
      const stat = statSync(fp);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (stat.isDirectory()) {
        results.push(`${rel}/`);
        if (recursive) walk(fp, rel);
      } else {
        results.push(rel);
      }
    }
  }
  walk(fullPath, dirPath === '.' ? '' : dirPath);

  return {
    title: `list: ${dirPath}`,
    output: results.join('\n'),
    metadata: { count: results.length },
  };
};

export const searchHandler: ToolHandler = async ({ params, projectDir }) => {
  const { query, glob: globPattern, maxResults = 50 } = params as { query: string; glob?: string; maxResults?: number };

  if (typeof query !== 'string' || query.length === 0) {
    throw new Error('search: query must be a non-empty string');
  }
  if (query.length > 1000) {
    throw new Error('search: query too long (max 1000 chars)');
  }

  const results: string[] = [];
  // No `g` flag: with regex.test() a sticky lastIndex would skip/alternate
  // matches across lines. Guard invalid patterns so a bad query is a clean
  // error rather than a thrown ReDoS-prone construction.
  let regex: RegExp;
  try {
    regex = new RegExp(query, 'i');
  } catch (err) {
    throw new Error(`search: invalid regular expression: ${err instanceof Error ? err.message : String(err)}`);
  }

  function searchDir(dir: string) {
    if (results.length >= maxResults) return;
    const entries = readdirSync(dir);
    for (const name of entries) {
      if (results.length >= maxResults) return;
      if (name.startsWith('.') || name === 'node_modules') continue;
      const fp = path.join(dir, name);
      const stat = statSync(fp);
      if (stat.isDirectory()) {
        searchDir(fp);
      } else {
        if (globPattern && !name.endsWith(globPattern.replace('*', ''))) continue;
        try {
          const content = readFileSync(fp, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              const rel = path.relative(projectDir, fp);
              results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
              if (results.length >= maxResults) return;
            }
          }
        } catch { /* skip binary files */ }
      }
    }
  }
  searchDir(projectDir);

  return {
    title: `search: ${query}`,
    output: results.length > 0 ? results.join('\n') : 'No matches found.',
    metadata: { count: results.length },
  };
};
