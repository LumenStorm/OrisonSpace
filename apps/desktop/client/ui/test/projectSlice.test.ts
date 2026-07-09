import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { createProjectSlice, type ProjectSlice } from '../src/shared/store/projectSlice';
import { createCreativeFieldsSlice, type CreativeFieldsSlice } from '../src/shared/store/creativeFieldsSlice';
import { createNovelChapterSlice, type NovelChapterSlice } from '../src/shared/store/novelChapterSlice';
import { createRecentProjectsSlice, type RecentProjectsSlice } from '../src/shared/store/recentProjectsSlice';
import { createBackgroundTasksSlice, type BackgroundTasksSlice } from '../src/shared/store/backgroundTasksSlice';
import { installProjectSubscription } from '../src/shared/store/projectSubscription';
import { loadLastProject } from '../src/shared/store/workspaceSession';
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
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

describe('projectSlice regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
    (globalThis.window as any) = globalThis.window ?? {};
    (window as any).orisonDesktop = {
      loadProjectDocument: vi.fn(async () => null),
      listTasks: vi.fn(async () => []),
      syncField: vi.fn(async () => undefined),
      syncChaptersMeta: vi.fn(async () => undefined),
      readDirectory: vi.fn(async () => []),
      readFile: vi.fn(async () => null),
      // refreshWordCount fires via the currentProject subscription; stub it so
      // the async call doesn't reject unhandled and fail the whole run.
      wordCount: vi.fn(async () => 0),
    };
  });

  it('会持久化并恢复上次打开的项目', () => {
    useTestStore.getState().openProject({
      name: 'Last Project',
      path: '/last-project',
      type: 'novel',
      logline: '上次写到这里',
    });

    useTestStore.setState({
      currentProject: null,
      projectDocumentHydrated: false,
      projectWordCount: 0,
    });

    useTestStore.getState().restoreLastProject();

    expect(useTestStore.getState().currentProject).toMatchObject({
      name: 'Last Project',
      path: '/last-project',
      type: 'novel',
      logline: '上次写到这里',
    });
  });

  it('更新当前项目元数据时会同步上次打开项目快照', () => {
    useTestStore.getState().openProject({
      name: 'Old Name',
      path: '/last-project',
      type: 'novel',
      logline: '旧一句话',
      coverImage: '/last-project/old.png',
    });

    useTestStore.getState().updateProjectMeta({
      name: 'New Name',
      logline: '新一句话',
      coverImage: '/last-project/new.png',
    });

    expect(loadLastProject()).toMatchObject({
      name: 'New Name',
      path: '/last-project',
      type: 'novel',
      logline: '新一句话',
      coverImage: '/last-project/new.png',
    });
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
    (window as any).orisonDesktop.readDirectory = vi.fn(async () => [
      {
        name: 'chapters',
        path: '/chapters',
        isDir: true,
        children: [{ name: 'ch_b.md', path: '/chapters/ch_b.md', isDir: false }],
      },
    ]);
    (window as any).orisonDesktop.readFile = vi.fn(async () => '# B 章节\n\nB 正文');

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

  it('打开手写 chapters 目录的项目时，会从磁盘派生章节元数据', async () => {
    (window as any).orisonDesktop.loadProjectDocument = vi.fn(async () => ({
      meta: { id: 'manual' },
      outline_v2: { title: '手写项目' },
    }));
    (window as any).orisonDesktop.readDirectory = vi.fn(async () => [
      {
        name: 'chapters',
        path: '/chapters',
        isDir: true,
        children: [
          { name: '第10章.md', path: '/chapters/第10章.md', isDir: false },
          { name: '第2章.md', path: '/chapters/第2章.md', isDir: false },
          { name: '第1章.md', path: '/chapters/第1章.md', isDir: false },
          { name: 'notes.txt', path: '/chapters/notes.txt', isDir: false },
        ],
      },
    ]);
    (window as any).orisonDesktop.readFile = vi.fn(async (fullPath: string) => {
      if (fullPath.endsWith('/第1章.md')) return '# 开篇\n\n第一章正文';
      if (fullPath.endsWith('/第2章.md')) return '# 第二章\n\n第二章正文';
      if (fullPath.endsWith('/第10章.md')) return '# 第十章\n\n第十章正文';
      return null;
    });

    useTestStore.getState().openProject({
      name: 'Manual Project',
      path: '/manual-project',
      type: 'novel',
    });
    await flushMicrotasks();

    expect(useTestStore.getState().novelChapters.map((ch) => ch.id)).toEqual(['第1章', '第2章', '第10章']);
    expect(useTestStore.getState().novelChapters[0]).toMatchObject({
      id: '第1章',
      title: '开篇',
      status: 'draft',
      sections: [{ contentFile: 'chapters/第1章.md', wordCount: 8 }],
    });
    expect((window as any).orisonDesktop.syncChaptersMeta).toHaveBeenLastCalledWith('/manual-project', [
      expect.objectContaining({
        id: '第1章',
        sections: [expect.objectContaining({ content_file: 'chapters/第1章.md', word_count: 8 })],
      }),
      expect.objectContaining({
        id: '第2章',
        sections: [expect.objectContaining({ content_file: 'chapters/第2章.md', word_count: 9 })],
      }),
      expect.objectContaining({
        id: '第10章',
        sections: [expect.objectContaining({ content_file: 'chapters/第10章.md', word_count: 9 })],
      }),
    ]);
  });

  it('磁盘派生章节会保留 project.yaml 里的标题状态和摘要', async () => {
    (window as any).orisonDesktop.loadProjectDocument = vi.fn(async () => ({
      meta: { id: 'manual' },
      novel: {
        chapters: [
          {
            id: '第1章',
            title: '用户改过的标题',
            sort_order: 9,
            status: 'final',
            summary: '用户摘要',
            summary_source: 'user',
            sections: [{ id: 'old-section', sort_order: 0, content_file: 'chapters/旧文件.md', word_count: 99 }],
          },
        ],
      },
    }));
    (window as any).orisonDesktop.readDirectory = vi.fn(async () => [
      {
        name: 'chapters',
        path: '/chapters',
        isDir: true,
        children: [
          { name: '第1章.md', path: '/chapters/第1章.md', isDir: false },
          { name: '第2章.md', path: '/chapters/第2章.md', isDir: false },
        ],
      },
    ]);
    (window as any).orisonDesktop.readFile = vi.fn(async (fullPath: string) => {
      if (fullPath.endsWith('/第1章.md')) return '# 磁盘标题\n\n第一章正文';
      if (fullPath.endsWith('/第2章.md')) return '# 新增章节\n\n第二章正文';
      return null;
    });

    useTestStore.getState().openProject({
      name: 'Manual Project',
      path: '/manual-project',
      type: 'novel',
    });
    await flushMicrotasks();

    expect(useTestStore.getState().novelChapters).toMatchObject([
      {
        id: '第1章',
        title: '用户改过的标题',
        status: 'final',
        summary: '用户摘要',
        summarySource: 'user',
        sections: [{ id: 'old-section', contentFile: 'chapters/第1章.md', wordCount: 10 }],
      },
      {
        id: '第2章',
        title: '新增章节',
        status: 'draft',
        sections: [{ contentFile: 'chapters/第2章.md', wordCount: 10 }],
      },
    ]);
  });
});
