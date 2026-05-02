import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type {
  NovelAutoModeState,
  NovelAutoModeStatus,
} from '@orison/shared-contracts';
import { runNovelPipeline } from '../novelPipeline';

export type NovelAutoModeStartParams = {
  projectPath: string;
  chapterIds?: string[];
  mode?: 'generate' | 'continue' | 'polish';
  reviewMode?: 'pass' | 'revise' | 'escalate';
};

export type NovelAutoModeRunner = {
  /** 初始化一个 auto-mode 会话，决定 pending 章节，状态置 running。 */
  start(params: NovelAutoModeStartParams): Promise<NovelAutoModeState>;
  /** 推进一个章节（pause/cancelled/completed 时立即返回当前状态，不推进）。 */
  runOnce(): Promise<NovelAutoModeState>;
  /** 暂停（运行中 → paused；其他状态保持）。 */
  pause(): void;
  /** 恢复（paused → running；其他状态保持）。 */
  resume(): void;
  /** 取消（→ cancelled）。 */
  cancel(): void;
  /** 获取当前状态快照（不可变）。 */
  getState(): NovelAutoModeState;
};

/**
 * 解析项目里待生成的章节列表（按 sort_order 升序，过滤 status=final）。
 */
function readPendingChapters(projectPath: string): string[] {
  const projectFile = path.join(projectPath, 'project.yaml');
  if (!existsSync(projectFile)) {
    throw new Error(`Project not found at ${projectPath}: project.yaml 缺失`);
  }
  const project = YAML.parse(readFileSync(projectFile, 'utf8')) as Record<string, any>;
  const chapters = (project?.novel?.chapters ?? []) as Array<Record<string, any>>;
  return chapters
    .filter((ch) => ch?.status !== 'final')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((ch) => String(ch.id));
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 工厂：创建一个 auto mode 运行器实例。每个实例维护独立的会话状态。
 */
export function createNovelAutoModeRunner(): NovelAutoModeRunner {
  let state: NovelAutoModeState | null = null;

  function ensureStarted(): NovelAutoModeState {
    if (!state) {
      throw new Error('auto mode not started — call start() first');
    }
    return state;
  }

  function setStatus(status: NovelAutoModeStatus, patch: Partial<NovelAutoModeState> = {}): NovelAutoModeState {
    const base = ensureStarted();
    state = {
      ...base,
      ...patch,
      status,
      updatedAt: nowIso(),
    };
    return state;
  }

  return {
    async start(params: NovelAutoModeStartParams): Promise<NovelAutoModeState> {
      const { projectPath, mode = 'generate' } = params;

      // 1. 计算 pending chapters
      let pending: string[];
      if (params.chapterIds && params.chapterIds.length > 0) {
        // 验证项目存在
        if (!existsSync(path.join(projectPath, 'project.yaml'))) {
          throw new Error(`Project not found at ${projectPath}: project.yaml 缺失`);
        }
        pending = [...params.chapterIds];
      } else {
        pending = readPendingChapters(projectPath);
      }

      const startedAt = nowIso();
      state = {
        autoModeId: `auto_${crypto.randomUUID()}`,
        projectPath,
        status: 'running',
        pendingChapterIds: pending,
        completedChapterIds: [],
        currentChapterId: null,
        currentRunId: null,
        totalChapters: pending.length,
        startedAt,
        updatedAt: startedAt,
        finishedAt: undefined,
        lastError: null,
      };
      // 保存为参数闭包，便于后续 runOnce 复用
      (state as any).__mode = mode;
      (state as any).__reviewMode = params.reviewMode ?? 'pass';
      return state;
    },

    async runOnce(): Promise<NovelAutoModeState> {
      const cur = ensureStarted();

      // 暂停 / 取消 / 已完成 → 直接返回，不推进
      if (cur.status !== 'running') {
        return cur;
      }

      // 没有更多章节 → completed
      if (cur.pendingChapterIds.length === 0) {
        return setStatus('completed', { finishedAt: nowIso(), currentChapterId: null, currentRunId: null });
      }

      const [nextChapter, ...rest] = cur.pendingChapterIds;
      const mode = ((cur as any).__mode ?? 'generate') as 'generate' | 'continue' | 'polish';
      const reviewMode = ((cur as any).__reviewMode ?? 'pass') as 'pass' | 'revise' | 'escalate';

      // 标记当前章节
      state = {
        ...cur,
        currentChapterId: nextChapter,
        updatedAt: nowIso(),
      };
      // 保留闭包字段
      (state as any).__mode = mode;
      (state as any).__reviewMode = reviewMode;

      try {
        const run = await runNovelPipeline({
          projectPath: cur.projectPath,
          chapterId: nextChapter,
          mode,
          reviewMode,
        });

        const completed = [...cur.completedChapterIds, nextChapter];
        const after: NovelAutoModeState = {
          ...cur,
          pendingChapterIds: rest,
          completedChapterIds: completed,
          currentChapterId: nextChapter,
          currentRunId: run.runId,
          status: rest.length === 0 ? 'completed' : 'running',
          finishedAt: rest.length === 0 ? nowIso() : undefined,
          updatedAt: nowIso(),
          lastError: null,
        };
        state = after;
        (state as any).__mode = mode;
        (state as any).__reviewMode = reviewMode;
        return after;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return setStatus('failed', {
          lastError: message,
          finishedAt: nowIso(),
        });
      }
    },

    pause(): void {
      const cur = ensureStarted();
      if (cur.status === 'running') {
        setStatus('paused');
      }
    },

    resume(): void {
      const cur = ensureStarted();
      if (cur.status === 'paused') {
        setStatus('running');
      }
    },

    cancel(): void {
      const cur = ensureStarted();
      if (cur.status === 'running' || cur.status === 'paused') {
        setStatus('cancelled', { finishedAt: nowIso() });
      }
    },

    getState(): NovelAutoModeState {
      return ensureStarted();
    },
  };
}
