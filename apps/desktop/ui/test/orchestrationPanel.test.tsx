import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestrationPanel } from '../src/features/orchestration/OrchestrationPanel';
import { useAppStore } from '../src/shared/store/appStore';

describe('OrchestrationPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppStore.setState({
      orchestrationRun: null,
      orchestrationLoading: false,
      orchestrationError: null,
      startOrchestrationRun: vi.fn().mockResolvedValue(undefined),
      refreshOrchestrationRun: vi.fn().mockResolvedValue(undefined),
      performOrchestrationAction: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  it('shows start button when no run exists', () => {
    render(<OrchestrationPanel />);
    // Tolerant to both raw-key (i18n not yet loaded) and translated forms.
    expect(screen.getByRole('button', { name: /启动主链路|Start Main Run|orchestration\.startMain/ })).toBeTruthy();
  });

  it('starts the main chain from the panel', async () => {
    render(<OrchestrationPanel />);
    await userEvent.click(screen.getByRole('button', { name: /启动主链路|Start Main Run|orchestration\.startMain/ }));
    expect(useAppStore.getState().startOrchestrationRun).toHaveBeenCalled();
  });

  it('shows node progress when run is active', () => {
    useAppStore.setState({
      orchestrationRun: {
        runId: 'run_test',
        status: 'running',
        currentNodeId: 'story-planner-agent',
        projectPath: 'test',
        completedNodes: ['intake-agent', 'asset-loader-agent'],
        pendingNodes: ['chapter-task-agent'],
        artifacts: {},
        review: null,
        archive: null,
        delivery: null,
        feedback: null,
      },
    } as any);

    render(<OrchestrationPanel />);
    expect(screen.getByText(/intake-agent/)).toBeTruthy();
    expect(screen.getByText(/story-planner-agent/)).toBeTruthy();
  });

  it('shows review actions when human_in_loop', async () => {
    useAppStore.setState({
      orchestrationRun: {
        runId: 'run_test',
        status: 'human_in_loop',
        currentNodeId: 'multi-review-agent',
        projectPath: 'test',
        completedNodes: ['intake-agent'],
        pendingNodes: [],
        artifacts: {},
        review: { verdict: 'escalate', summary: 'Needs human review', reasons: ['conflict'] },
        archive: null,
        delivery: null,
        feedback: null,
      },
    } as any);

    render(<OrchestrationPanel />);
    const acceptBtn = screen.getByRole('button', { name: /接受当前结果|Accept Current|orchestration\.acceptCurrent/ });
    expect(acceptBtn).toBeTruthy();
    expect(screen.getByRole('button', { name: /终止流程|Abort Run|orchestration\.abortRun/ })).toBeTruthy();

    await userEvent.click(acceptBtn);
    expect(useAppStore.getState().performOrchestrationAction).toHaveBeenCalledWith({ action: 'accept_current' });
  });

  it('shows delivery info when delivered', () => {
    useAppStore.setState({
      orchestrationRun: {
        runId: 'run_test',
        status: 'delivered',
        currentNodeId: null,
        projectPath: 'test',
        completedNodes: ['intake-agent', 'multi-review-agent'],
        pendingNodes: [],
        artifacts: {},
        review: null,
        archive: { versionId: 'ver_123', archivedAt: '2026-04-24T00:00:00Z', promptFiles: [] },
        delivery: { deliveryId: 'dlv_123', deliveredAt: '2026-04-24T00:00:00Z', format: 'json', content: {}, summary: '交付完成' },
        feedback: { feedbackId: 'fb_123', createdAt: '2026-04-24T00:00:00Z', assetPatches: [], memo: '无审核记录' },
      },
    } as any);

    render(<OrchestrationPanel />);
    expect(screen.getByText(/ver_123/)).toBeTruthy();
  });
});
