import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoModeConsole } from '../src/features/auto-mode/AutoModeConsole';
import { useAppStore } from '../src/shared/store/appStore';

describe('AutoModeConsole full-novel planning controls', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useAppStore.setState({
      currentProject: {
        projectId: 'p',
        name: 'Full Novel',
        path: 'C:/projects/full-novel',
        type: 'novel',
      },
      autoModeState: null,
      autoModeError: null,
      startAutoMode: vi.fn().mockResolvedValue(undefined),
      approveAutoModePlan: vi.fn().mockResolvedValue(undefined),
      pauseAutoMode: vi.fn().mockResolvedValue(undefined),
      resumeAutoMode: vi.fn().mockResolvedValue(undefined),
      cancelAutoMode: vi.fn().mockResolvedValue(undefined),
      refreshAutoMode: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  it('passes the human plot summary when starting full auto mode', async () => {
    render(<AutoModeConsole />);
    await userEvent.type(
      screen.getByPlaceholderText(/human-approved story premise|autoMode\.plotSummaryPlaceholder/i),
      'A courier uncovers a sealed-city conspiracy.',
    );
    await userEvent.click(screen.getByRole('button', { name: /Start Auto Mode|autoMode\.start/i }));

    expect(useAppStore.getState().startAutoMode).toHaveBeenCalledWith(
      undefined,
      'A courier uncovers a sealed-city conspiracy.',
    );
  });

  it('approves a generated planning bundle before chapter execution', async () => {
    useAppStore.setState({
      autoModeState: {
        autoModeId: 'auto_plan',
        projectPath: 'p',
        status: 'awaiting_approval',
        pendingChapterIds: ['ch_001'],
        completedChapterIds: [],
        currentChapterId: null,
        currentRunId: null,
        totalChapters: 1,
        lastError: null,
        plotSummary: 'Approved premise',
        planning: {
          status: 'generated',
          bundlePath: 'runs/auto-mode/auto_plan-planning-bundle.yaml',
          artifactKeys: ['creative_brief', 'episode_outlines'],
        },
      },
    } as any);

    render(<AutoModeConsole />);
    await userEvent.click(screen.getByRole('button', { name: /Approve Plan|autoMode\.approvePlan/i }));

    expect(useAppStore.getState().approveAutoModePlan).toHaveBeenCalled();
  });
});
