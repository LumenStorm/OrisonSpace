import type { z } from 'zod';
import type {
  novelChapterRunRequestSchema,
  novelAutoModeStateSchema,
} from '@orison/shared-contracts';
import { API_BASE } from '../constants';

export type NovelChapterRunMode = z.infer<typeof novelChapterRunRequestSchema>['mode'];
export type AutoModeState = z.infer<typeof novelAutoModeStateSchema>;

export type AutoModeAction = 'pause' | 'resume' | 'cancel';

type StartChapterRunInput = {
  projectPath: string;
  chapterId: string;
  mode: NovelChapterRunMode;
  instruction?: string;
};

export async function startChapterRun(input: StartChapterRunInput): Promise<unknown> {
  const res = await fetch(`${API_BASE}/v1/orchestration/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectPath: input.projectPath,
      chapterId: input.chapterId,
      mode: input.mode,
      ...(input.instruction ? { instruction: input.instruction } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`startChapterRun:${res.status}`);
  }
  return res.json();
}

export async function startAutoMode(projectPath: string, chapterIds?: string[]): Promise<AutoModeState> {
  const res = await fetch(`${API_BASE}/v1/orchestration/auto-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectPath,
      mode: 'generate',
      ...(chapterIds && chapterIds.length > 0 ? { chapterIds } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`startAutoMode:${res.status}`);
  }
  return (await res.json()) as AutoModeState;
}

export async function performAutoModeAction(autoModeId: string, action: AutoModeAction): Promise<AutoModeState> {
  const res = await fetch(`${API_BASE}/v1/orchestration/auto-mode/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoModeId, action }),
  });
  if (!res.ok) {
    throw new Error(`autoModeAction:${action}:${res.status}`);
  }
  return (await res.json()) as AutoModeState;
}

export async function refreshAutoMode(autoModeId: string): Promise<AutoModeState | null> {
  const res = await fetch(
    `${API_BASE}/v1/orchestration/auto-mode/${encodeURIComponent(autoModeId)}`,
  );
  if (!res.ok) return null;
  return (await res.json()) as AutoModeState;
}
