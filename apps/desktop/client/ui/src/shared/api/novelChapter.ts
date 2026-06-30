import type { z } from 'zod';
import type {
  novelChapterRunRequestSchema,
  RunStorySyncResult,
  ModelRef,
  NovelModelRuntime,
} from '@orison/shared-contracts';

export type NovelChapterRunMode = z.infer<typeof novelChapterRunRequestSchema>['mode'];

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

  // TODO: Route chapter runs through agent session instead of removed orchestration stub
  return { status: 'not_implemented', artifacts };
}
