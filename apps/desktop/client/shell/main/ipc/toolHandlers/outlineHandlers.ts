/**
 * Outline tool handlers — outline_read, outline_update
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { assertWithinProject } from '../pathGuard';
import { notifyUI } from '../toolNotify';
import type { ToolHandler } from '../toolExecution';
import { atomicWriteFileSync } from '../../fs/atomicWrite';

const OUTLINE_FILE = 'outline.md';

export const outlineReadHandler: ToolHandler = async ({ projectDir }) => {
  const filePath = path.join(projectDir, OUTLINE_FILE);
  assertWithinProject(projectDir, filePath);
  if (!existsSync(filePath)) return { title: 'outline_read', output: 'No outline.md found.' };

  const content = readFileSync(filePath, 'utf-8');
  return { title: 'outline_read', output: content };
};

export const outlineUpdateHandler: ToolHandler = async ({ params, projectDir }) => {
  const { content } = params as { content: string };
  const filePath = path.join(projectDir, OUTLINE_FILE);
  assertWithinProject(projectDir, filePath);

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    if (existing === content) {
      return { title: 'outline_update', output: `Outline already up to date (${content.length} chars). No changes needed — proceed to the next step.` };
    }
  }

  atomicWriteFileSync(filePath, content, 'utf-8');
  notifyUI({ type: 'outline:changed' });
  return { title: 'outline_update', output: `Updated outline (${content.length} chars). Outline saved successfully — proceed to the next phase.` };
};
