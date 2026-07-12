import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolEvents } from '../src/shared/hooks/useToolEvents';
import { useAppStore } from '../src/shared/store/appStore';

function ToolEventsHarness() {
  useToolEvents();
  return null;
}

describe('useToolEvents 章节磁盘派生', () => {
  let emitToolEvent: ((event: { type: string; [key: string]: unknown }) => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    emitToolEvent = null;
    useAppStore.setState({
      currentProject: null,
      novelChapters: [],
      openFiles: [],
    } as any);
    (window as any).orisonDesktop = {
      onToolEvent: vi.fn((callback) => {
        emitToolEvent = callback;
        return vi.fn();
      }),
      readDirectory: vi.fn(async () => [
        {
          name: 'chapters',
          path: '/chapters',
          isDir: true,
          children: [
            { name: '第1章.md', path: '/chapters/第1章.md', isDir: false },
            { name: '第2章.md', path: '/chapters/第2章.md', isDir: false },
          ],
        },
      ]),
      readFile: vi.fn(async (fullPath: string) => {
        if (fullPath.endsWith('/第1章.md')) return '# 磁盘标题\n\n第一章正文';
        if (fullPath.endsWith('/第2章.md')) return '# 新章节\n\n第二章正文';
        return null;
      }),
      syncChaptersMeta: vi.fn(async () => ({ ok: true })),
      wordCount: vi.fn(async () => 0),
    };
    useAppStore.setState({
      currentProject: { projectId: 'p1', name: 'Manual', path: '/manual-project', type: 'novel' },
    } as any);
    useAppStore.setState({
      novelChapters: [
        {
          id: '第1章',
          title: '用户标题',
          sortOrder: 0,
          status: 'final',
          summary: '已有摘要',
          summarySource: 'user',
          sections: [{ id: '第1章_main', sortOrder: 0, contentFile: 'chapters/第1章.md', wordCount: 99 }],
        },
      ],
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('chapters 目录文件变化后会重新派生章节并保留已存元数据', async () => {
    render(<ToolEventsHarness />);

    act(() => {
      emitToolEvent?.({
        type: 'file:changed',
        projectPath: '/manual-project',
        path: 'chapters\\第2章.md',
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useAppStore.getState().novelChapters.map((chapter) => chapter.id)).toEqual(['第1章', '第2章']);
    expect(useAppStore.getState().novelChapters[0]).toMatchObject({
      title: '用户标题',
      status: 'final',
      summary: '已有摘要',
      sections: [{ contentFile: 'chapters/第1章.md', wordCount: 10 }],
    });
    expect(useAppStore.getState().novelChapters[1]).toMatchObject({
      title: '新章节',
      status: 'draft',
      sections: [{ contentFile: 'chapters/第2章.md', wordCount: 9 }],
    });
  });
});
