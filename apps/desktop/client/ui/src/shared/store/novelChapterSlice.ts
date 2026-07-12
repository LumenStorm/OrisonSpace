import type { StateCreator } from 'zustand';
import type { z } from 'zod';
import type { ModelConfig, ModelRef, storyMemoryEntrySchema } from '@orison/shared-contracts';
import {
  startChapterRun,
  type NovelChapterRunMode,
} from '../api/novelChapter';
import { resolveNovelModelRuntime } from '../model/novelModel';
import { storage } from './storage';
import { registerProjectReset } from './resetRegistry';
import { useToastStore } from './toastStore';

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

export type { NovelChapterRunMode } from '../api/novelChapter';

export type NovelChapterSlice = {
  novelChapters: NovelChapterMeta[];
  setNovelChapters: (chapters: NovelChapterMeta[]) => void;
  moveNovelChapter: (fromIndex: number, toIndex: number) => void;

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
};

const NO_PROJECT_KEY = 'novelChapter.noProject';
const UNKNOWN_ERROR_KEY = 'novelChapter.unknownError';
const START_FAILED_PREFIX = 'startChapterRun:';

function statusFromMessage(message: string, prefix: string): string {
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function errorKeyFromStart(error: unknown): string {
  if (error instanceof Error && error.message.startsWith(START_FAILED_PREFIX)) {
    return `novelChapter.startFailed|${statusFromMessage(error.message, START_FAILED_PREFIX)}`;
  }
  return error instanceof Error ? error.message : UNKNOWN_ERROR_KEY;
}

async function persistChaptersMeta(chapters: NovelChapterMeta[], projectPath?: string) {
  if (!projectPath || !window.orisonDesktop?.syncChaptersMeta) return { ok: true } as const;
  return window.orisonDesktop.syncChaptersMeta(projectPath, chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    sort_order: ch.sortOrder,
    status: ch.status,
    summary: ch.summary,
    summary_source: ch.summarySource,
    sections: ch.sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      sort_order: sec.sortOrder,
      content_file: sec.contentFile,
      word_count: sec.wordCount,
    })),
  })));
}

function persistChaptersMetaWithFeedback(chapters: NovelChapterMeta[], projectPath?: string): void {
  void persistChaptersMeta(chapters, projectPath).then((result) => {
    if (!result.ok) {
      useToastStore.getState().showToast(`章节元数据保存失败: ${result.error}`, 'error');
    }
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    useToastStore.getState().showToast(`章节元数据保存失败: ${message}`, 'error');
  });
}

export const createNovelChapterSlice: StateCreator<
  NovelChapterSlice & { currentProject: { path?: string } | null; modelConfig: ModelConfig },
  [],
  [],
  NovelChapterSlice
> = (set, get) => {
  // Chapter list, active selection and any in-flight candidate belong to the
  // current project. Clear on switch; projectSubscription re-hydrates the list
  // from the new project's novel.chapters. Memory entries are also per-project.
  registerProjectReset(() => {
    set({
      novelChapters: [],
      activeChapterId: null,
      chapterCandidate: null,
      chapterCandidateStatus: 'idle',
      chapterCandidateError: null,
      memoryEntries: [],
    });
  });

  return {
  novelChapters: [],
  setNovelChapters: (chapters) => {
    const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
    set({ novelChapters: sorted });
    persistChaptersMetaWithFeedback(sorted, get().currentProject?.path);
  },

  moveNovelChapter: (fromIndex, toIndex) => {
    const { novelChapters } = get();
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= novelChapters.length) return;
    if (toIndex < 0 || toIndex >= novelChapters.length) return;
    const next = [...novelChapters];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const reordered = next.map((ch, i) => ({ ...ch, sortOrder: i }));
    set({ novelChapters: reordered });
    persistChaptersMetaWithFeedback(reordered, get().currentProject?.path);
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
      const syncResult = await persistChaptersMeta(updated, project.path);
      if (!syncResult.ok) throw new Error(syncResult.error);
      // Candidate markdown was written to disk; refresh the project word count.
      void (get() as { refreshWordCount?: () => Promise<void> }).refreshWordCount?.();
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
  };
};

function mergeMemoryEntries(existing: StoryMemoryEntry[], incoming: StoryMemoryEntry[]): StoryMemoryEntry[] {
  const byId = new Map<string, StoryMemoryEntry>();
  for (const entry of existing) byId.set(entry.id, entry);
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()];
}
