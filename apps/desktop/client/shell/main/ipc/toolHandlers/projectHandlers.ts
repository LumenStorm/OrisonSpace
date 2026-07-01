/**
 * Project tool handlers — project_meta, memory_query, memory_update, skill
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assertWithinProject } from '../pathGuard';
import { notifyUI } from '../toolNotify';
import type { ToolHandler } from './types';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';

export const projectMetaHandler: ToolHandler = async ({ projectDir }) => {
  const metaPath = path.join(projectDir, 'project.yaml');
  if (!existsSync(metaPath)) return { title: 'project_meta', output: 'No project.yaml found.' };

  const content = readFileSync(metaPath, 'utf-8');
  return { title: 'project_meta', output: content };
};

export const memoryQueryHandler: ToolHandler = async ({ params, projectDir }) => {
  const { query } = params as { query?: string };
  const memPath = path.join(projectDir, 'story-memory.yaml');
  assertWithinProject(projectDir, memPath);
  if (!existsSync(memPath)) return { title: 'memory_query', output: 'No story-memory.yaml found.' };

  const content = readFileSync(memPath, 'utf-8');
  if (!query) return { title: 'memory_query', output: content };

  // Simple keyword filter on sections
  const lines = content.split('\n');
  const matched = lines.filter((l) => l.toLowerCase().includes(query.toLowerCase()));
  return {
    title: `memory_query: ${query}`,
    output: matched.length > 0 ? matched.join('\n') : `No matches for "${query}".`,
    metadata: { count: matched.length },
  };
};

export const memoryUpdateHandler: ToolHandler = async ({ params, projectDir }) => {
  const { content } = params as { content: string };
  const memPath = path.join(projectDir, 'story-memory.yaml');
  assertWithinProject(projectDir, memPath);
  atomicWriteFileSync(memPath, content, 'utf-8');

  // Notify memory listeners (recall) and file-level listeners (open-tab reload).
  // Without file:changed, an editor showing story-memory.yaml won't refresh
  // until manually closed and reopened. Path is project-relative, matching
  // writeFileHandler's convention.
  notifyUI({ type: 'memory:changed' });
  notifyUI({ type: 'file:changed', path: 'story-memory.yaml' });
  return { title: 'memory_update', output: `Updated story-memory.yaml (${content.length} chars)` };
};

export const skillHandler: ToolHandler = async ({ params, projectDir }) => {
  const { name } = params as { name: string };
  const skillsDir = path.join(projectDir, '.orison', 'skills');
  assertWithinProject(projectDir, skillsDir);

  if (!existsSync(skillsDir)) return { title: 'skill', output: `Skill "${name}" not found. Available: none` };

  const files = readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
  const match = files.find((f) => f.replace('.md', '') === name);
  if (!match) {
    const available = files.map((f) => f.replace('.md', '')).join(', ');
    return { title: 'skill', output: `Skill "${name}" not found. Available: ${available || 'none'}` };
  }

  const content = readFileSync(path.join(skillsDir, match), 'utf-8');
  return { title: `skill: ${name}`, output: content };
};
