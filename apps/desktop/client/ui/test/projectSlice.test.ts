import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { createProjectSlice, type ProjectSlice } from '../src/shared/store/projectSlice';
import { createCreativeFieldsSlice, type CreativeFieldsSlice } from '../src/shared/store/creativeFieldsSlice';
import { createNovelChapterSlice, type NovelChapterSlice } from '../src/shared/store/novelChapterSlice';
import { createRecentProjectsSlice, type RecentProjectsSlice } from '../src/shared/store/recentProjectsSlice';
import { createBackgroundTasksSlice, type BackgroundTasksSlice } from '../src/shared/store/backgroundTasksSlice';
import { installProjectSubscription } from '../src/shared/store/projectSubscription';
import type { ModelConfig } from '@orison/shared-contracts';

declare global {
  interface Window {
    orisonDesktop: any;
  }
}

type TestState =
  ProjectSlice &
  CreativeFieldsSlice &
  NovelChapterSlice &
  RecentProjectsSlice &
  BackgroundTasksSlice & {
    modelConfig: ModelConfig;
  };

const EMPTY_MODEL_CONFIG: ModelConfig = { keys: [] };

const useTestStore = create<TestState>()((...a) => ({
  modelConfig: EMPTY_MODEL_CONFIG,
  ...createProjectSlice(...a),
  ...createCreativeFieldsSlice(...a),
  ...createNovelChapterSlice(...a),
  ...createRecentProjectsSlice(...a),
  ...createBackgroundTasksSlice(...a),
}));

// The clear-old-data / load-new-document behavior moved out of openProject
// into a store subscription on currentProject (see projectSubscription.ts).
// Install it on the test store so we exercise the CURRENT wiring.
installProjectSubscription(useTestStore as any);

function resetStore() {
  useTestStore.setState({
    currentProject: null,
    activeModule: 'overview',
    creativeFields: {},
    fieldMetadata: {},
    activeCreativeTab: 'world_setting',
    pendingPatch: null,
    patchSelections: {},
    novelChapters: [],
    activeChapterId: null,
    chapterCandidate: null,
    chapterCandidateStatus: 'idle',
    chapterCandidateError: null,
    memoryEntries: [],
    selectedNovelRef: null,
    autoModeState: null,
    autoModeError: null,
    recentProjects: [],
    bgTasks: [],
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('projectSlice regressions', () => {
  beforeEach(() => {
    resetStore();
    (globalThis.window as any) = globalThis.window ?? {};
    (window as any).orisonDesktop = {
      loadProjectDocument: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      syncField: vi.fn(async () => undefined),
      // refreshWordCount fires via the currentProject subscription; stub it so
      // the async call doesn't reject unhandled and fail the whole run.
      wordCount: vi.fn(async () => 0),
    };
  });

  it('openProject 失败或无 novel 数据时会清空旧章节和创作字段', async () => {
    useTestStore.setState({
      creativeFields: { outline: { title: '旧提纲' } },
      novelChapters: [
        {
          id: 'ch_old',
          title: '旧章节',
          sortOrder: 0,
          status: 'draft',
          sections: [{ id: 's1', sortOrder: 0, contentFile: 'chapters/old.md', wordCount: 100 }],
        },
      ],
    });

    useTestStore.getState().openProject({
      name: 'Script Project',
      path: '/script-project',
      type: 'script',
    });
    await flushMicrotasks();

    expect(useTestStore.getState().creativeFields).toEqual({});
    expect(useTestStore.getState().novelChapters).toEqual([]);
  });

  it('项目切换后，旧项目迟到的 loadProjectDocument 结果不会污染当前项目', async () => {
    const first = deferred<any>();
    const second = deferred<any>();

    (window as any).orisonDesktop.loadProjectDocument = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    useTestStore.getState().openProject({
      name: 'Project A',
      path: '/project-a',
      type: 'novel',
    });
    useTestStore.getState().openProject({
      name: 'Project B',
      path: '/project-b',
      type: 'novel',
    });

    second.resolve({
      meta: { id: 'b' },
      novel: {
        chapters: [
          {
            id: 'ch_b',
            title: 'B 章节',
            sort_order: 0,
            status: 'draft',
            sections: [{ id: 'ch_b_s1', sort_order: 0, content_file: 'chapters/b.md', word_count: 12 }],
          },
        ],
      },
      outline_v2: { title: 'B 提纲' },
    });
    await flushMicrotasks();

    first.resolve({
      meta: { id: 'a' },
      novel: {
        chapters: [
          {
            id: 'ch_a',
            title: 'A 章节',
            sort_order: 0,
            status: 'draft',
            sections: [{ id: 'ch_a_s1', sort_order: 0, content_file: 'chapters/a.md', word_count: 99 }],
          },
        ],
      },
      outline_v2: { title: 'A 提纲' },
    });
    await flushMicrotasks();

    expect(useTestStore.getState().currentProject?.path).toBe('/project-b');
    expect(useTestStore.getState().creativeFields.outline).toEqual({ title: 'B 提纲' });
    expect(useTestStore.getState().novelChapters.map((ch) => ch.id)).toEqual(['ch_b']);
  });
});
