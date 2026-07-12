import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolEvents } from '../src/shared/hooks/useToolEvents';
import { useAppStore } from '../src/shared/store/appStore';

function ToolEventsHarness() {
  useToolEvents();
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useToolEvents 文件对账', () => {
  let emitToolEvent: ((event: { type: string; [key: string]: unknown }) => void) | null = null;

  beforeEach(() => {
    localStorage.clear();
    emitToolEvent = null;
    useAppStore.setState({
      currentProject: { projectId: 'p1', name: 'Project', path: '/p', type: 'novel' },
      openFiles: [],
      activeFilePath: null,
    } as any);
    (window as any).orisonDesktop = {
      onToolEvent: vi.fn((callback) => {
        emitToolEvent = callback;
        return vi.fn();
      }),
      wordCount: vi.fn(async () => 0),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('读盘期间用户开始编辑时保留输入并标记外部冲突', async () => {
    const read = deferred<string>();
    (window as any).orisonDesktop.readFile = vi.fn(() => read.promise);
    useAppStore.getState().openFile('/p/a.md', 'a.md', 'original');
    render(<ToolEventsHarness />);

    act(() => {
      emitToolEvent?.({ type: 'file:changed', projectPath: '/p', path: 'a.md' });
    });
    useAppStore.getState().updateFileContent('/p/a.md', 'user edit');
    await act(async () => {
      read.resolve('disk edit');
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useAppStore.getState().openFiles[0]).toMatchObject({
        content: 'user edit',
        savedContent: 'original',
        externalState: 'changed',
      });
    });
  });

  it('忽略来源项目与当前项目不一致的工具事件', async () => {
    const readFile = vi.fn(async () => 'project A disk edit');
    (window as any).orisonDesktop.readFile = readFile;
    useAppStore.getState().openFile('/p/a.md', 'a.md', 'project B');
    render(<ToolEventsHarness />);

    act(() => {
      emitToolEvent?.({ type: 'file:changed', projectPath: '/project-a', path: 'a.md' });
    });
    await Promise.resolve();

    expect(readFile).not.toHaveBeenCalled();
    expect(useAppStore.getState().openFiles[0].content).toBe('project B');
    expect(useAppStore.getState().openFiles[0].externalState).toBeUndefined();
  });

  it('忽略没有来源项目的工具事件', async () => {
    const readFile = vi.fn(async () => 'unscoped disk edit');
    (window as any).orisonDesktop.readFile = readFile;
    useAppStore.getState().openFile('/p/a.md', 'a.md', 'current');
    render(<ToolEventsHarness />);

    act(() => {
      emitToolEvent?.({ type: 'file:changed', path: 'a.md' });
    });
    await Promise.resolve();

    expect(readFile).not.toHaveBeenCalled();
    expect(useAppStore.getState().openFiles[0].content).toBe('current');
  });
});
