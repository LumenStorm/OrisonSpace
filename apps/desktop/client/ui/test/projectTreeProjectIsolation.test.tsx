import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectTree } from '../src/features/project-tree/ProjectTree';
import { useAppStore } from '../src/shared/store/appStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('ProjectTree 项目隔离', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      currentProject: null,
      openFiles: [],
      activeFilePath: null,
      mainView: 'files',
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('旧项目刷新迟到时不会覆盖新项目文件树', async () => {
    const refreshA = deferred<any[]>();
    const readDirectory = vi.fn((path: string, depth: number) => {
      if (path === '/project-a' && depth === 1) {
        return Promise.resolve([{ name: 'a.txt', path: '/a.txt', isDir: false }]);
      }
      if (path === '/project-a' && depth === 3) return refreshA.promise;
      if (path === '/project-b' && depth === 1) {
        return Promise.resolve([{ name: 'b.txt', path: '/b.txt', isDir: false }]);
      }
      return Promise.resolve([]);
    });
    (window as any).orisonDesktop = {
      readDirectory,
      watchProject: vi.fn(),
      unwatchProject: vi.fn(),
    };
    useAppStore.setState({
      currentProject: { projectId: 'a', name: 'Project A', path: '/project-a', type: 'novel' },
    } as any);

    render(<ProjectTree />);
    await screen.findByText('a.txt');
    fireEvent.click(screen.getByRole('button', { name: /projectTree.refresh|refresh/i }));
    await waitFor(() => expect(readDirectory).toHaveBeenCalledWith('/project-a', 3));

    act(() => {
      useAppStore.setState({
        currentProject: { projectId: 'b', name: 'Project B', path: '/project-b', type: 'novel' },
      } as any);
    });
    await screen.findByText('b.txt');

    await act(async () => {
      refreshA.resolve([{ name: 'stale-a.txt', path: '/stale-a.txt', isDir: false }]);
      await Promise.resolve();
    });

    expect(screen.getByText('b.txt')).toBeTruthy();
    expect(screen.queryByText('stale-a.txt')).toBeNull();
  });

  it('旧项目文件读取迟到时不会在新项目打开标签', async () => {
    const readA = deferred<string>();
    (window as any).orisonDesktop = {
      readDirectory: vi.fn((path: string) => Promise.resolve([
        { name: path === '/project-a' ? 'a.txt' : 'b.txt', path: path === '/project-a' ? '/a.txt' : '/b.txt', isDir: false },
      ])),
      readFile: vi.fn((path: string) => path === '/project-a/a.txt' ? readA.promise : Promise.resolve('b')),
      watchProject: vi.fn(),
      unwatchProject: vi.fn(),
    };
    useAppStore.setState({
      currentProject: { projectId: 'a', name: 'Project A', path: '/project-a', type: 'novel' },
    } as any);

    render(<ProjectTree />);
    fireEvent.click(await screen.findByText('a.txt'));

    act(() => {
      useAppStore.setState({
        currentProject: { projectId: 'b', name: 'Project B', path: '/project-b', type: 'novel' },
      } as any);
    });
    await screen.findByText('b.txt');

    await act(async () => {
      readA.resolve('stale a');
      await readA.promise;
    });

    expect(useAppStore.getState().openFiles).toEqual([]);
  });

  it('旧项目创建迟到时不会向新项目树插入节点或打开标签', async () => {
    const createA = deferred<boolean>();
    (window as any).orisonDesktop = {
      readDirectory: vi.fn((path: string) => Promise.resolve([
        { name: path === '/project-a' ? 'a.txt' : 'b.txt', path: path === '/project-a' ? '/a.txt' : '/b.txt', isDir: false },
      ])),
      createEntry: vi.fn(() => createA.promise),
      watchProject: vi.fn(),
      unwatchProject: vi.fn(),
    };
    useAppStore.setState({
      currentProject: { projectId: 'a', name: 'Project A', path: '/project-a', type: 'novel' },
    } as any);

    render(<ProjectTree />);
    await screen.findByText('a.txt');
    fireEvent.contextMenu(screen.getByText('Project A'));
    fireEvent.click(screen.getByRole('menuitem', { name: /contextMenu.newFile|new file/i }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'late.txt' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    act(() => {
      useAppStore.setState({
        currentProject: { projectId: 'b', name: 'Project B', path: '/project-b', type: 'novel' },
      } as any);
    });
    await screen.findByText('b.txt');

    await act(async () => {
      createA.resolve(true);
      await createA.promise;
    });

    expect(screen.queryByText('late.txt')).toBeNull();
    expect(useAppStore.getState().openFiles).toEqual([]);
  });

  it('旧项目重命名迟到时不会修改新项目树', async () => {
    const renameA = deferred<boolean>();
    (window as any).orisonDesktop = {
      readDirectory: vi.fn(() => Promise.resolve([
        { name: 'shared.txt', path: '/shared.txt', isDir: false },
      ])),
      renameEntry: vi.fn(() => renameA.promise),
      watchProject: vi.fn(),
      unwatchProject: vi.fn(),
    };
    useAppStore.setState({
      currentProject: { projectId: 'a', name: 'Project A', path: '/project-a', type: 'novel' },
    } as any);

    render(<ProjectTree />);
    fireEvent.contextMenu(await screen.findByText('shared.txt'));
    fireEvent.click(screen.getByRole('menuitem', { name: /contextMenu.rename|rename/i }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'renamed.txt' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    act(() => {
      useAppStore.setState({
        currentProject: { projectId: 'b', name: 'Project B', path: '/project-b', type: 'novel' },
      } as any);
    });
    await waitFor(() => expect(screen.getByText('shared.txt')).toBeTruthy());

    await act(async () => {
      renameA.resolve(true);
      await renameA.promise;
    });

    expect(screen.getByText('shared.txt')).toBeTruthy();
    expect(screen.queryByText('renamed.txt')).toBeNull();
  });

  it('旧项目删除迟到时不会从新项目树移除同路径节点', async () => {
    const deleteA = deferred<boolean>();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (window as any).orisonDesktop = {
      readDirectory: vi.fn(() => Promise.resolve([
        { name: 'shared.txt', path: '/shared.txt', isDir: false },
      ])),
      deleteEntry: vi.fn(() => deleteA.promise),
      watchProject: vi.fn(),
      unwatchProject: vi.fn(),
    };
    useAppStore.setState({
      currentProject: { projectId: 'a', name: 'Project A', path: '/project-a', type: 'novel' },
    } as any);

    render(<ProjectTree />);
    fireEvent.contextMenu(await screen.findByText('shared.txt'));
    fireEvent.click(screen.getByRole('menuitem', { name: /contextMenu.delete|delete/i }));

    act(() => {
      useAppStore.setState({
        currentProject: { projectId: 'b', name: 'Project B', path: '/project-b', type: 'novel' },
      } as any);
    });
    await waitFor(() => expect(screen.getByText('shared.txt')).toBeTruthy());

    await act(async () => {
      deleteA.resolve(true);
      await deleteA.promise;
    });

    expect(screen.getByText('shared.txt')).toBeTruthy();
  });
});
