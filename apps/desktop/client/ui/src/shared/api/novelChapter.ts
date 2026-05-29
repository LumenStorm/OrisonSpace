import type { z } from 'zod';
import type {
  novelChapterRunRequestSchema,
  novelAutoModeStateSchema,
  RunStorySyncResult,
  ModelRef,
  NovelModelRuntime,
} from '@orison/shared-contracts';

export type NovelChapterRunMode = z.infer<typeof novelChapterRunRequestSchema>['mode'];
export type AutoModeState = z.infer<typeof novelAutoModeStateSchema>;

export type AutoModeAction = 'approve_plan' | 'pause' | 'resume' | 'cancel';

type StartChapterRunInput = {
  projectPath: string;
  chapterId: string;
  mode: NovelChapterRunMode;
  instruction?: string;
  storySyncRef?: ModelRef | null;
  modelRuntime?: NovelModelRuntime | null;
  storySyncContext?: {
    runId?: string;
    candidate?: Record<string, unknown>;
    context?: Record<string, unknown>;
    fieldVersions?: Record<string, number>;
  };
};

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

  const requirement = [
    `mode:${input.mode}`,
    `chapter:${input.chapterId}`,
    input.instruction ?? '',
  ].filter(Boolean).join(' | ');

  return window.orisonDesktop.startOrchestrationRun({
    projectPath: input.projectPath,
    requirement,
  });
}

export async function startAutoMode(
  projectPath: string,
  chapterIds?: string[],
  plotSummary?: string,
  modelRuntime?: NovelModelRuntime | null,
): Promise<AutoModeState> {
  return window.orisonDesktop.startAutoMode({
    projectPath,
    mode: 'generate',
    ...(chapterIds && chapterIds.length > 0 ? { chapterIds } : {}),
    ...(plotSummary?.trim() ? { plotSummary: plotSummary.trim() } : {}),
    ...(modelRuntime ? { modelRuntime } : {}),
  }) as Promise<AutoModeState>;
}

export async function performAutoModeAction(autoModeId: string, action: AutoModeAction): Promise<AutoModeState> {
  return window.orisonDesktop.performAutoModeAction(autoModeId, action) as Promise<AutoModeState>;
}

export async function refreshAutoMode(autoModeId: string): Promise<AutoModeState | null> {
  return window.orisonDesktop.getAutoModeState(autoModeId) as Promise<AutoModeState | null>;
}
