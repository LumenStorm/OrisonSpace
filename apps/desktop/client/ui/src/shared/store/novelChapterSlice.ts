import type { StateCreator } from 'zustand';
import type { z } from 'zod';
import type { ModelConfig, ModelRef, storyMemoryEntrySchema } from '@orison/shared-contracts';
import {
  performAutoModeAction,
  refreshAutoMode,
  startAutoMode,
  startChapterRun,
  type AutoModeAction,
  type AutoModeState,
  type NovelChapterRunMode,
} from '../api/novelChapter';
import { resolveNovelModelRuntime } from '../model/novelModel';
import { storage } from './storage';

export type ChapterStatus = 'draft' | 'generating' | 'revised' | 'final';

export type SectionMeta = {
  id: string;
  title?: string;
  sortOrder: number;
  contentFile: string;
  wordCount?: number;
};

export type NovelChapterMeta = {
  id: string;
  title: string;
  sortOrder: number;
  status: ChapterStatus;
  summary?: string;
  summarySource?: 'ai' | 'user';
  sections: SectionMeta[];
};

export type ChapterCandidate = {
  chapterId: string;
  runId: string;
  title?: string;
  content: string;
  summary?: string;
  wordCount?: number;
};

export type ChapterCandidateStatus = 'idle' | 'running' | 'pending' | 'accepted' | 'rejected' | 'failed';

export type StoryMemoryEntry = z.infer<typeof storyMemoryEntrySchema>;

export type { NovelChapterRunMode, AutoModeState } from '../api/novelChapter';

export type NovelChapterSlice = {
  novelChapters: NovelChapterMeta[];
  setNovelChapters: (chapters: NovelChapterMeta[]) => void;

  activeChapterId: string | null;
  selectChapter: (chapterId: string) => void;

  chapterCandidate: ChapterCandidate | null;
  chapterCandidateStatus: ChapterCandidateStatus;
  chapterCandidateError: string | null;

  startChapterRun: (chapterId: string, mode: NovelChapterRunMode, instruction?: string) => Promise<void>;
  acceptChapterCandidate: () => Promise<void>;
  rejectChapterCandidate: () => void;

  memoryEntries: StoryMemoryEntry[];
  setMemoryEntries: (entries: StoryMemoryEntry[]) => void;

  selectedNovelRef: ModelRef | null;
  setSelectedNovelRef: (ref: ModelRef | null) => void;

  autoModeState: AutoModeState | null;
  autoModeError: string | null;
  startAutoMode: (chapterIds?: string[], plotSummary?: string) => Promise<void>;
  approveAutoModePlan: () => Promise<void>;
  pauseAutoMode: () => Promise<void>;
  resumeAutoMode: () => Promise<void>;
  cancelAutoMode: () => Promise<void>;
  refreshAutoMode: () => Promise<void>;
};

const NO_PROJECT_KEY = 'novelChapter.noProject';
const UNKNOWN_ERROR_KEY = 'novelChapter.unknownError';
const START_FAILED_PREFIX = 'startChapterRun:';
const AUTO_PROJECT_KEY = 'autoMode.noProject';
const AUTO_UNKNOWN_KEY = 'autoMode.unknownError';
const AUTO_START_PREFIX = 'startAutoMode:';

function statusFromMessage(message: string, prefix: string): string {
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function errorKeyFromStart(error: unknown): string {
  if (error instanceof Error && error.message.startsWith(START_FAILED_PREFIX)) {
    return `novelChapter.startFailed|${statusFromMessage(error.message, START_FAILED_PREFIX)}`;
  }
  return error instanceof Error ? error.message : UNKNOWN_ERROR_KEY;
}

function errorKeyFromAutoStart(error: unknown): string {
  if (error instanceof Error && error.message.startsWith(AUTO_START_PREFIX)) {
    return `autoMode.startFailed|${statusFromMessage(error.message, AUTO_START_PREFIX)}`;
  }
  return error instanceof Error ? error.message : AUTO_UNKNOWN_KEY;
}

function persistChaptersMeta(chapters: NovelChapterMeta[], projectPath?: string) {
  if (!projectPath || !window.orisonDesktop?.syncChaptersMeta) return;
  window.orisonDesktop.syncChaptersMeta(projectPath, chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    sort_order: ch.sortOrder,
    status: ch.status,
    summary: ch.summary,
    summary_source: ch.summarySource,
  })));
}

export const createNovelChapterSlice: StateCreator<
  NovelChapterSlice & { currentProject: { path?: string } | null; modelConfig: ModelConfig },
  [],
  [],
  NovelChapterSlice
> = (set, get) => ({
  novelChapters: [],
  setNovelChapters: (chapters) => {
    const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
    set({ novelChapters: sorted });
    persistChaptersMeta(sorted, get().currentProject?.path);
  },

  activeChapterId: null,
  selectChapter: (chapterId) => {
    set({
      activeChapterId: chapterId,
      chapterCandidate: null,
      chapterCandidateStatus: 'idle',
      chapterCandidateError: null,
    });
  },

  chapterCandidate: null,
  chapterCandidateStatus: 'idle',
  chapterCandidateError: null,

  async startChapterRun(chapterId, mode, instruction) {
    const project = get().currentProject;
    if (!project?.path) {
      set({ chapterCandidateError: NO_PROJECT_KEY, chapterCandidateStatus: 'failed' });
      return;
    }
    set({
      activeChapterId: chapterId,
      chapterCandidate: null,
      chapterCandidateStatus: 'running',
      chapterCandidateError: null,
    });

    try {
      const run = (await startChapterRun({
        projectPath: project.path,
        chapterId,
        mode,
        instruction,
        modelRuntime: resolveNovelModelRuntime(get().modelConfig.keys, get().selectedNovelRef),
      })) as {
        runId: string;
        artifacts?: {
          'chapter.candidate'?: ChapterCandidate;
          'memory.extracted'?: { entries?: StoryMemoryEntry[] };
        };
      };

      const candidate = run?.artifacts?.['chapter.candidate'];
      const memArtifact = run?.artifacts?.['memory.extracted'];

      if (candidate) {
        set({
          chapterCandidate: { ...candidate, runId: run.runId },
          chapterCandidateStatus: 'pending',
        });
      } else {
        set({ chapterCandidateStatus: 'failed', chapterCandidateError: 'novelChapter.noCandidate' });
      }

      if (memArtifact?.entries) {
        const merged = mergeMemoryEntries(get().memoryEntries, memArtifact.entries);
        set({ memoryEntries: merged });
      }
    } catch (error) {
      set({
        chapterCandidateStatus: 'failed',
        chapterCandidateError: errorKeyFromStart(error),
      });
    }
  },

  async acceptChapterCandidate() {
    const candidate = get().chapterCandidate;
    const project = get().currentProject;
    if (!candidate || !project?.path) return;

    try {
      const updated = get().novelChapters.map((ch) =>
        ch.id === candidate.chapterId
          ? { ...ch, status: 'final' as ChapterStatus, summary: candidate.summary ?? ch.summary, title: candidate.title ?? ch.title }
          : ch
      );
      set({
        novelChapters: updated,
        chapterCandidate: null,
        chapterCandidateStatus: 'accepted',
      });
      persistChaptersMeta(updated, project.path);
    } catch (error) {
      set({
        chapterCandidateStatus: 'failed',
        chapterCandidateError: error instanceof Error ? error.message : 'novelChapter.acceptFailed',
      });
    }
  },

  rejectChapterCandidate() {
    set({
      chapterCandidate: null,
      chapterCandidateStatus: 'rejected',
      chapterCandidateError: null,
    });
  },

  memoryEntries: [],
  setMemoryEntries: (entries) => set({ memoryEntries: [...entries] }),

  selectedNovelRef: storage.get<ModelRef | null>('selectedNovelRef', null),
  setSelectedNovelRef(ref) {
    storage.set('selectedNovelRef', ref);
    set({ selectedNovelRef: ref });
  },

  autoModeState: null,
  autoModeError: null,

  async startAutoMode(chapterIds, plotSummary) {
    const project = get().currentProject;
    if (!project?.path) {
      set({ autoModeError: AUTO_PROJECT_KEY });
      return;
    }
    set({ autoModeError: null });
    try {
      const state = await startAutoMode(
        project.path,
        chapterIds,
        plotSummary,
        resolveNovelModelRuntime(get().modelConfig.keys, get().selectedNovelRef),
      );
      set({ autoModeState: state });
    } catch (error) {
      set({ autoModeError: errorKeyFromAutoStart(error) });
    }
  },

  async pauseAutoMode() {
    await applyAutoModeAction(get, set, 'pause');
  },

  async approveAutoModePlan() {
    await applyAutoModeAction(get, set, 'approve_plan');
  },

  async resumeAutoMode() {
    await applyAutoModeAction(get, set, 'resume');
  },

  async cancelAutoMode() {
    await applyAutoModeAction(get, set, 'cancel');
  },

  async refreshAutoMode() {
    const cur = get().autoModeState;
    if (!cur) return;
    try {
      const state = await refreshAutoMode(cur.autoModeId);
      if (state) set({ autoModeState: state });
    } catch (error) {
      set({ autoModeError: error instanceof Error ? error.message : AUTO_UNKNOWN_KEY });
    }
  },
});

async function applyAutoModeAction(
  get: () => { autoModeState: AutoModeState | null },
  set: (partial: { autoModeState?: AutoModeState; autoModeError?: string | null }) => void,
  action: AutoModeAction,
): Promise<void> {
  const cur = get().autoModeState;
  if (!cur) return;
  try {
    const state = await performAutoModeAction(cur.autoModeId, action);
    set({ autoModeState: state });
  } catch (error) {
    set({ autoModeError: error instanceof Error ? error.message : AUTO_UNKNOWN_KEY });
  }
}

function mergeMemoryEntries(existing: StoryMemoryEntry[], incoming: StoryMemoryEntry[]): StoryMemoryEntry[] {
  const byId = new Map<string, StoryMemoryEntry>();
  for (const entry of existing) byId.set(entry.id, entry);
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()];
}
