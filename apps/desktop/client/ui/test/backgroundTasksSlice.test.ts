import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { createBackgroundTasksSlice, type BackgroundTasksSlice } from '../src/shared/store/backgroundTasksSlice';
import { runProjectResets } from '../src/shared/store/resetRegistry';

declare global {
  interface Window {
    orisonDesktop: any;
  }
}

type TestState = BackgroundTasksSlice & {
  currentProject: { projectId?: string } | null;
};

const useTestStore = create<TestState>()((...args) => ({
  currentProject: null,
  ...createBackgroundTasksSlice(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function taskRecord(project: string) {
  return {
    taskId: `task-${project}`,
    taskType: 'text_gen',
    status: 'completed',
    name: project,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  };
}

describe('backgroundTasksSlice project isolation', () => {
  beforeEach(() => {
    useTestStore.setState({ currentProject: null, bgTasks: [] });
    (globalThis.window as any) = globalThis.window ?? {};
    (window as any).orisonDesktop = {
      listTasks: vi.fn(async () => []),
      upsertTask: vi.fn(),
      deleteTask: vi.fn(),
    };
  });

  it('ignores a stale project load that resolves after the current project', async () => {
    const projectA = deferred<any[]>();
    const projectB = deferred<any[]>();
    (window as any).orisonDesktop.listTasks = vi
      .fn()
      .mockImplementationOnce(() => projectA.promise)
      .mockImplementationOnce(() => projectB.promise);

    useTestStore.setState({ currentProject: { projectId: 'A' } });
    const loadA = useTestStore.getState().loadBgTasks();
    useTestStore.setState({ currentProject: { projectId: 'B' } });
    const loadB = useTestStore.getState().loadBgTasks();

    projectB.resolve([taskRecord('B')]);
    await loadB;
    projectA.resolve([taskRecord('A')]);
    await loadA;

    expect(useTestStore.getState().bgTasks.map((task) => task.id)).toEqual(['task-B']);
  });

  it('clears the visible task list when project-scoped state resets', () => {
    useTestStore.setState({
      currentProject: { projectId: 'A' },
      bgTasks: [{
        id: 'task-A',
        type: 'text_gen',
        status: 'running',
        label: 'A',
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z',
      }],
    });

    runProjectResets();

    expect(useTestStore.getState().bgTasks).toEqual([]);
  });

  it('persists completion to the originating project without updating another project view', async () => {
    const execution = deferred<unknown>();
    useTestStore.setState({ currentProject: { projectId: 'A' } });
    useTestStore.getState().submitBgTask({
      type: 'text_gen',
      label: 'A task',
      execute: () => execution.promise,
    });

    useTestStore.setState({ currentProject: { projectId: 'B' }, bgTasks: [] });
    execution.resolve({ text: 'done' });
    await execution.promise;
    await Promise.resolve();

    expect(useTestStore.getState().bgTasks).toEqual([]);
    expect((window as any).orisonDesktop.upsertTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'A', status: 'completed' }),
    );
  });
});
