import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type {
  NovelAutoModeState,
  NovelAutoModeStatus,
  NovelModelRuntime,
} from '@orison/shared-contracts';
import { runNovelPipeline } from '../novelPipeline';
import {
  approveFullNovelPlanning,
  createFullNovelPlanningBundle,
  FULL_NOVEL_PLANNING_KEYS,
} from './fullNovelPlanning';

export type NovelAutoModeStartParams = {
  projectPath: string;
  chapterIds?: string[];
  plotSummary?: string;
  mode?: 'generate' | 'continue' | 'polish';
  reviewMode?: 'pass' | 'revise' | 'escalate';
  modelRuntime?: NovelModelRuntime;
};

export type NovelAutoModePersist = (state: NovelAutoModeState) => void | Promise<void>;

export type NovelAutoModeRunnerOptions = {
  persist?: NovelAutoModePersist;
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
  approvePlan(): Promise<NovelAutoModeState>;
  /** 取消（→ cancelled）。 */
  cancel(): void;
  /** 获取当前状态快照（不可变）。 */
  getState(): NovelAutoModeState;
  /** 直接载入既有状态（用于崩溃恢复）。 */
  hydrate(state: NovelAutoModeState): void;
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
export function createNovelAutoModeRunner(options: NovelAutoModeRunnerOptions = {}): NovelAutoModeRunner {
  let state: NovelAutoModeState | null = null;
  const persist = options.persist;
  let pendingPersist: Promise<void> = Promise.resolve();
  let modelRuntime: NovelModelRuntime | undefined;

  function ensureStarted(): NovelAutoModeState {
    if (!state) {
      throw new Error('auto mode not started — call start() first');
    }
    return state;
  }

  function commit(next: NovelAutoModeState): NovelAutoModeState {
    state = next;
    if (persist) {
      pendingPersist = pendingPersist.then(() => Promise.resolve(persist(next))).catch(() => undefined);
    }
    return next;
  }

  async function commitAsync(next: NovelAutoModeState): Promise<NovelAutoModeState> {
    commit(next);
    await pendingPersist;
    return next;
  }

  function setStatus(status: NovelAutoModeStatus, patch: Partial<NovelAutoModeState> = {}): NovelAutoModeState {
    const base = ensureStarted();
    return commit({
      ...base,
      ...patch,
      status,
      updatedAt: nowIso(),
    });
  }

  return {
    async start(params: NovelAutoModeStartParams): Promise<NovelAutoModeState> {
      const { projectPath, mode = 'generate' } = params;
      modelRuntime = params.modelRuntime;

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
      const autoModeId = `auto_${crypto.randomUUID()}`;
      const plan = createFullNovelPlanningBundle({
        projectPath,
        autoModeId,
        plotSummary: params.plotSummary,
        requestedChapterIds: params.chapterIds,
      });
      const plannedPending = params.chapterIds?.length ? [...params.chapterIds] : readPendingChapters(projectPath);
      const finalPending = plannedPending.length > 0 ? plannedPending : plan.chapterIds;
      return commitAsync({
        autoModeId,
        projectPath,
        status: 'awaiting_approval',
        pendingChapterIds: finalPending,
        completedChapterIds: [],
        currentChapterId: null,
        currentRunId: null,
        totalChapters: finalPending.length,
        startedAt,
        updatedAt: startedAt,
        finishedAt: undefined,
        lastError: null,
        mode,
        reviewMode: params.reviewMode ?? 'pass',
        modelRef: modelRuntime ? { keyId: modelRuntime.keyId, modelId: modelRuntime.modelId } : undefined,
        plotSummary: plan.bundle.plotSummary,
        planning: {
          status: 'generated',
          bundlePath: plan.bundlePath,
          artifactKeys: [...FULL_NOVEL_PLANNING_KEYS],
          generatedAt: startedAt,
        },
      });
    },

    async runOnce(): Promise<NovelAutoModeState> {
      const cur = ensureStarted();

      // 暂停 / 取消 / 已完成 → 直接返回，不推进
      if (cur.status !== 'running') {
        return cur;
      }

      // 没有更多章节 → completed
      if (cur.pendingChapterIds.length === 0) {
        return commitAsync({
          ...cur,
          status: 'completed',
          finishedAt: nowIso(),
          currentChapterId: null,
          currentRunId: null,
          updatedAt: nowIso(),
        });
      }

      const [nextChapter, ...rest] = cur.pendingChapterIds;
      const mode = cur.mode ?? 'generate';
      const reviewMode = cur.reviewMode ?? 'pass';

      // 标记当前章节
      commit({
        ...cur,
        currentChapterId: nextChapter,
        updatedAt: nowIso(),
      });

      try {
        const run = await runNovelPipeline({
          projectPath: cur.projectPath,
          chapterId: nextChapter,
          mode,
          reviewMode,
          modelRuntime,
        });

        const completed = [...cur.completedChapterIds, nextChapter];
        return commitAsync({
          ...cur,
          pendingChapterIds: rest,
          completedChapterIds: completed,
          currentChapterId: nextChapter,
          currentRunId: run.runId,
          status: rest.length === 0 ? 'completed' : 'running',
          finishedAt: rest.length === 0 ? nowIso() : undefined,
          updatedAt: nowIso(),
          lastError: null,
          mode,
          reviewMode,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return commitAsync({
          ...ensureStarted(),
          status: 'failed',
          lastError: message,
          finishedAt: nowIso(),
          updatedAt: nowIso(),
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

    async approvePlan(): Promise<NovelAutoModeState> {
      const cur = ensureStarted();
      if (cur.status !== 'awaiting_approval') return cur;
      approveFullNovelPlanning(cur.projectPath, cur.autoModeId);
      return commitAsync({
        ...cur,
        status: 'running',
        planning: {
          ...(cur.planning ?? { status: 'generated', artifactKeys: [] }),
          status: 'approved',
          approvedAt: nowIso(),
        },
        updatedAt: nowIso(),
      });
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

    hydrate(loaded: NovelAutoModeState): void {
      state = loaded;
    },
  };
}
