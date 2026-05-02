import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoModeConsole } from '../src/features/auto-mode/AutoModeConsole';
import { useAppStore } from '../src/shared/store/appStore';

describe('AutoModeConsole', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useAppStore.setState({
      currentProject: {
        projectId: 'p',
        name: '暗城',
        path: 'C:/projects/暗城',
        type: 'novel',
      },
      autoModeState: null,
      autoModeError: null,
      startAutoMode: vi.fn().mockResolvedValue(undefined),
      pauseAutoMode: vi.fn().mockResolvedValue(undefined),
      resumeAutoMode: vi.fn().mockResolvedValue(undefined),
      cancelAutoMode: vi.fn().mockResolvedValue(undefined),
      refreshAutoMode: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  it('未启动时显示启动按钮', () => {
    render(<AutoModeConsole />);
    expect(screen.getByRole('button', { name: '启动自动模式' })).toBeTruthy();
  });

  it('点击启动按钮调用 startAutoMode', async () => {
    render(<AutoModeConsole />);
    await userEvent.click(screen.getByRole('button', { name: '启动自动模式' }));
    expect(useAppStore.getState().startAutoMode).toHaveBeenCalled();
  });

  it('运行中显示进度（已完成 / 总数）+ 当前章节', () => {
    useAppStore.setState({
      autoModeState: {
        autoModeId: 'auto_x',
        projectPath: 'C:/projects/暗城',
        status: 'running',
        pendingChapterIds: ['ch_c'],
        completedChapterIds: ['ch_b'],
        currentChapterId: 'ch_c',
        currentRunId: 'run_novel_xx',
        totalChapters: 2,
        lastError: null,
      },
    } as any);
    render(<AutoModeConsole />);
    expect(screen.getByText(/状态：运行中/)).toBeTruthy();
    expect(screen.getByText(/进度：1\s*\/\s*2/)).toBeTruthy();
    expect(screen.getByText(/当前章节：ch_c/)).toBeTruthy();
  });

  it('运行中显示暂停 + 取消按钮', () => {
    useAppStore.setState({
      autoModeState: {
        autoModeId: 'auto_x',
        projectPath: 'p',
        status: 'running',
        pendingChapterIds: [],
        completedChapterIds: [],
        currentChapterId: null,
        currentRunId: null,
        totalChapters: 0,
        lastError: null,
      },
    } as any);
    render(<AutoModeConsole />);
    expect(screen.getByRole('button', { name: '暂停' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy();
  });

  it('暂停状态显示恢复按钮', () => {
    useAppStore.setState({
      autoModeState: {
        autoModeId: 'auto_x',
        projectPath: 'p',
        status: 'paused',
        pendingChapterIds: ['ch_b'],
        completedChapterIds: [],
        currentChapterId: 'ch_b',
        currentRunId: null,
        totalChapters: 1,
        lastError: null,
      },
    } as any);
    render(<AutoModeConsole />);
    expect(screen.getByText(/状态：已暂停/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '恢复' })).toBeTruthy();
  });

  it('点击暂停按钮调用 pauseAutoMode', async () => {
    useAppStore.setState({
      autoModeState: {
        autoModeId: 'auto_x',
        projectPath: 'p',
        status: 'running',
        pendingChapterIds: [],
        completedChapterIds: [],
        currentChapterId: null,
        currentRunId: null,
        totalChapters: 0,
        lastError: null,
      },
    } as any);
    render(<AutoModeConsole />);
    await userEvent.click(screen.getByRole('button', { name: '暂停' }));
    expect(useAppStore.getState().pauseAutoMode).toHaveBeenCalled();
  });

  it('completed 状态显示完成提示，无控制按钮', () => {
    useAppStore.setState({
      autoModeState: {
        autoModeId: 'auto_x',
        projectPath: 'p',
        status: 'completed',
        pendingChapterIds: [],
        completedChapterIds: ['ch_a', 'ch_b'],
        currentChapterId: null,
        currentRunId: null,
        totalChapters: 2,
        lastError: null,
      },
    } as any);
    render(<AutoModeConsole />);
    expect(screen.getByText(/状态：已完成/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '暂停' })).toBeNull();
    expect(screen.queryByRole('button', { name: '取消' })).toBeNull();
  });

  it('失败状态显示错误信息', () => {
    useAppStore.setState({
      autoModeState: {
        autoModeId: 'auto_x',
        projectPath: 'p',
        status: 'failed',
        pendingChapterIds: [],
        completedChapterIds: [],
        currentChapterId: 'ch_b',
        currentRunId: null,
        totalChapters: 1,
        lastError: 'python node failed',
      },
    } as any);
    render(<AutoModeConsole />);
    expect(screen.getByText(/状态：失败/)).toBeTruthy();
    expect(screen.getByText(/python node failed/)).toBeTruthy();
  });
});
