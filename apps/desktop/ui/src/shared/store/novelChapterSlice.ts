import type { StateCreator } from 'zustand';
import type { z } from 'zod';
import type {
  storyMemoryEntrySchema,
  novelChapterRunRequestSchema,
  novelAutoModeStateSchema,
} from '@orison/shared-contracts';
import { API_BASE } from '../constants';

export type ChapterStatus = 'draft' | 'generating' | 'revised' | 'final';

export type NovelChapterMeta = {
  id: string;
  title: string;
  sortOrder: number;
  status: ChapterStatus;
  summary?: string;
  contentFile?: string;
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

export type NovelChapterRunMode = z.infer<typeof novelChapterRunRequestSchema>['mode'];

export type AutoModeState = z.infer<typeof novelAutoModeStateSchema>;

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

  // ── Auto Mode (Phase 6) ──
  autoModeState: AutoModeState | null;
  autoModeError: string | null;
  startAutoMode: (chapterIds?: string[]) => Promise<void>;
  pauseAutoMode: () => Promise<void>;
  resumeAutoMode: () => Promise<void>;
  cancelAutoMode: () => Promise<void>;
  refreshAutoMode: () => Promise<void>;
};

export const createNovelChapterSlice: StateCreator<
  NovelChapterSlice & { currentProject: { path?: string } | null },
  [],
  [],
  NovelChapterSlice
> = (set, get) => ({
  novelChapters: [],
  setNovelChapters: (chapters) =>
    set({ novelChapters: [...chapters].sort((a, b) => a.sortOrder - b.sortOrder) }),

  activeChapterId: null,
  selectChapter: (chapterId) => {
    set({
      activeChapterId: chapterId,
      // 切换章节时清空当前 candidate
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
      set({ chapterCandidateError: '当前未打开项目', chapterCandidateStatus: 'failed' });
      return;
    }
    set({
      activeChapterId: chapterId,
      chapterCandidate: null,
      chapterCandidateStatus: 'running',
      chapterCandidateError: null,
    });

    try {
      const res = await fetch(`${API_BASE}/v1/orchestration/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: project.path,
          chapterId,
          mode,
          ...(instruction ? { instruction } : {}),
        }),
      });
      if (!res.ok) throw new Error(`启动章节失败: ${res.status}`);
      const run = await res.json();

      const candidate = run?.artifacts?.['chapter.candidate'] as ChapterCandidate | undefined;
      const memArtifact = run?.artifacts?.['memory.extracted'] as { entries?: StoryMemoryEntry[] } | undefined;

      if (candidate) {
        set({
          chapterCandidate: { ...candidate, runId: run.runId },
          chapterCandidateStatus: 'pending',
        });
      } else {
        set({ chapterCandidateStatus: 'failed', chapterCandidateError: '本次 run 未产出 candidate' });
      }

      if (memArtifact?.entries) {
        const merged = mergeMemoryEntries(get().memoryEntries, memArtifact.entries);
        set({ memoryEntries: merged });
      }
    } catch (error) {
      set({
        chapterCandidateStatus: 'failed',
        chapterCandidateError: error instanceof Error ? error.message : '未知错误',
      });
    }
  },

  async acceptChapterCandidate() {
    const candidate = get().chapterCandidate;
    const project = get().currentProject;
    if (!candidate || !project?.path) return;

    // 通过 IPC 让 local-bff 写入磁盘（preload 暴露的 API）
    const desktopApi = (globalThis as any).window?.orisonDesktop;
    try {
      if (desktopApi?.acceptChapterCandidate) {
        await desktopApi.acceptChapterCandidate(project.path, candidate);
      }
      // 更新本地章节状态
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
    } catch (error) {
      set({
        chapterCandidateStatus: 'failed',
        chapterCandidateError: error instanceof Error ? error.message : '接受失败',
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

  // ── Auto Mode ──
  autoModeState: null,
  autoModeError: null,

  async startAutoMode(chapterIds) {
    const project = get().currentProject;
    if (!project?.path) {
      set({ autoModeError: '当前未打开项目' });
      return;
    }
    set({ autoModeError: null });
    try {
      const res = await fetch(`${API_BASE}/v1/orchestration/auto-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: project.path,
          mode: 'generate',
          ...(chapterIds && chapterIds.length > 0 ? { chapterIds } : {}),
        }),
      });
      if (!res.ok) throw new Error(`启动自动模式失败: ${res.status}`);
      const state = (await res.json()) as AutoModeState;
      set({ autoModeState: state });
    } catch (error) {
      set({ autoModeError: error instanceof Error ? error.message : '未知错误' });
    }
  },

  async pauseAutoMode() {
    await applyAutoModeAction(get, set, 'pause');
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
      const res = await fetch(
        `${API_BASE}/v1/orchestration/auto-mode/${encodeURIComponent(cur.autoModeId)}`
      );
      if (!res.ok) return;
      const state = (await res.json()) as AutoModeState;
      set({ autoModeState: state });
    } catch (error) {
      set({ autoModeError: error instanceof Error ? error.message : '未知错误' });
    }
  },
});

async function applyAutoModeAction(
  get: () => { autoModeState: AutoModeState | null },
  set: (partial: { autoModeState?: AutoModeState; autoModeError?: string | null }) => void,
  action: 'pause' | 'resume' | 'cancel'
): Promise<void> {
  const cur = get().autoModeState;
  if (!cur) return;
  try {
    const res = await fetch(`${API_BASE}/v1/orchestration/auto-mode/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoModeId: cur.autoModeId, action }),
    });
    if (!res.ok) throw new Error(`动作失败 ${action}: ${res.status}`);
    const state = (await res.json()) as AutoModeState;
    set({ autoModeState: state });
  } catch (error) {
    set({ autoModeError: error instanceof Error ? error.message : '未知错误' });
  }
}

function mergeMemoryEntries(existing: StoryMemoryEntry[], incoming: StoryMemoryEntry[]): StoryMemoryEntry[] {
  const byId = new Map<string, StoryMemoryEntry>();
  for (const entry of existing) byId.set(entry.id, entry);
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()];
}
