import type { z } from 'zod';
import type {
  novelChapterRunRequestSchema,
  novelAutoModeStateSchema,
  RunStorySyncResult,
  ModelRef,
} from '@orison/shared-contracts';
import { API_BASE } from '../constants';

export type NovelChapterRunMode = z.infer<typeof novelChapterRunRequestSchema>['mode'];
export type AutoModeState = z.infer<typeof novelAutoModeStateSchema>;

export type AutoModeAction = 'approve_plan' | 'pause' | 'resume' | 'cancel';

type StartChapterRunInput = {
  projectPath: string;
  chapterId: string;
  mode: NovelChapterRunMode;
  instruction?: string;
  /**
   * Model ref used to drive the story-sync LLM extraction locally before
   * the orchestration request is posted to server.
   */
  storySyncRef?: ModelRef | null;
  storySyncContext?: {
    runId?: string;
    candidate?: Record<string, unknown>;
    context?: Record<string, unknown>;
    fieldVersions?: Record<string, number>;
  };
};

/**
 * Kick off a chapter orchestration run.
 *
 * When `storySyncRef` is provided: the renderer runs the story-sync LLM
 * extraction on desktop main first, packs the safe patches into
 * `artifacts['chapter.llmPatches']`, then POSTs the run to server.
 *
 * When `storySyncRef` is null/undefined (rules-only run): the request is
 * posted without `chapter.llmPatches`.
 */
export async function startChapterRun(input: StartChapterRunInput): Promise<unknown> {
  const artifacts: Record<string, unknown> = {};

  if (input.storySyncRef && window.orisonDesktop?.runStorySync) {
    try {
      const result: RunStorySyncResult = await window.orisonDesktop.runStorySync({
        ref: input.storySyncRef,
        runId: input.storySyncContext?.runId ?? `desktop-${Date.now()}`,
        chapterId: input.chapterId,
        candidate: input.storySyncContext?.candidate ?? {},
        context: input.storySyncContext?.context ?? {},
        fieldVersions: input.storySyncContext?.fieldVersions ?? {},
      });
      if (!result.fallbackToRules && result.patches.length > 0) {
        artifacts['chapter.llmPatches'] = result.patches;
      }
    } catch {
      // Story-sync is best-effort; if the IPC throws, fall back to rules path.
    }
  }

  const body: Record<string, unknown> = {
    projectPath: input.projectPath,
    chapterId: input.chapterId,
    mode: input.mode,
  };
  if (input.instruction) body.instruction = input.instruction;
  if (Object.keys(artifacts).length > 0) body.artifacts = artifacts;

  const res = await fetch(`${API_BASE}/v1/orchestration/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`startChapterRun:${res.status}`);
  }
  return res.json();
}

export async function startAutoMode(
  projectPath: string,
  chapterIds?: string[],
  plotSummary?: string,
): Promise<AutoModeState> {
  const res = await fetch(`${API_BASE}/v1/orchestration/auto-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectPath,
      mode: 'generate',
      ...(chapterIds && chapterIds.length > 0 ? { chapterIds } : {}),
      ...(plotSummary?.trim() ? { plotSummary: plotSummary.trim() } : {}),
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
