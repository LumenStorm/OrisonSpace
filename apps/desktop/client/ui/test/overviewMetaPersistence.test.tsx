import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewPage } from '../src/features/overview/OverviewPage';
import { gitCreateNode, gitLog } from '../src/shared/api/git';
import { useAppStore } from '../src/shared/store/appStore';

vi.mock('../src/shared/api/git', () => ({
  gitIsRepo: vi.fn(async () => false),
  gitLog: vi.fn(async () => []),
  gitCreateNode: vi.fn(async () => undefined),
  gitStatusCount: vi.fn(async () => 0),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe('Overview 项目元数据持久化', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      currentProject: {
        projectId: 'project-a',
        name: 'Project A',
        path: '/project-a',
        type: 'novel',
      },
      creativeFields: {},
      novelChapters: [],
      projectWordCount: 0,
      openFiles: [],
    } as any);
    (window as any).orisonDesktop = {
      saveProjectMeta: vi.fn(async () => undefined),
      wordCount: vi.fn(async () => 0),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('输入立即进入 Store，并在卸载时保存最后值', () => {
    const view = render(<OverviewPage />);
    const nameInput = screen.getByPlaceholderText('Project Name');

    fireEvent.change(nameInput, { target: { value: 'Project A edited' } });

    expect(useAppStore.getState().currentProject?.name).toBe('Project A edited');
    view.unmount();
    expect((window as any).orisonDesktop.saveProjectMeta).toHaveBeenCalledWith(
      '/project-a',
      expect.objectContaining({ name: 'Project A edited' }),
    );
  });

  it('选择封面期间切换项目时不写入新项目', async () => {
    const picked = deferred<string | null>();
    (window as any).orisonDesktop.pickCoverImage = vi.fn(() => picked.promise);
    (window as any).orisonDesktop.copyCoverImage = vi.fn(async () => '/project-a/cover.png');

    render(<OverviewPage />);
    fireEvent.click(screen.getByTitle('Set cover'));

    await act(async () => {
      useAppStore.setState({
        currentProject: {
          projectId: 'project-b',
          name: 'Project B',
          path: '/project-b',
          type: 'novel',
        },
      } as any);
      picked.resolve('/external/cover.png');
      await picked.promise;
    });

    expect((window as any).orisonDesktop.copyCoverImage).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentProject?.coverImage).toBeUndefined();
  });

  it('快照完成时不把旧项目记录渲染到新项目', async () => {
    const created = deferred<void>();
    vi.mocked(gitCreateNode).mockImplementation(() => created.promise);
    vi.mocked(gitLog).mockResolvedValue([]);

    render(<OverviewPage />);
    await act(async () => {});
    vi.mocked(gitLog).mockClear();
    fireEvent.click(screen.getByText('Save version'));

    await act(async () => {
      useAppStore.setState({
        currentProject: {
          projectId: 'project-b',
          name: 'Project B',
          path: '/project-b',
          type: 'novel',
        },
      } as any);
      created.resolve();
      await created.promise;
    });

    expect(vi.mocked(gitLog).mock.calls.filter(([path]) => path === '/project-a')).toHaveLength(0);
  });
});
