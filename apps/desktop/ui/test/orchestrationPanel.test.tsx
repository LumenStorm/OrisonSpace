import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestrationPanel } from '../src/features/orchestration/OrchestrationPanel';
import { useOrchestrationStore } from '../src/shared/store/orchestrationStore';

describe('OrchestrationPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useOrchestrationStore.setState({
      run: null,
      loading: false,
      error: null,
      startRun: vi.fn().mockResolvedValue(undefined),
      refreshRun: vi.fn().mockResolvedValue(undefined),
      performAction: vi.fn().mockResolvedValue(undefined)
    });
  });

  it('shows start button when no run exists', () => {
    render(<OrchestrationPanel />);
    expect(screen.getByRole('button', { name: '启动主链路' })).toBeTruthy();
  });

  it('starts the main chain from the panel', async () => {
    render(<OrchestrationPanel />);
    await userEvent.click(screen.getByRole('button', { name: '启动主链路' }));
    expect(useOrchestrationStore.getState().startRun).toHaveBeenCalled();
  });

  it('shows node progress when run is active', () => {
    useOrchestrationStore.setState({
      run: {
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
        feedback: null
      }
    });

    render(<OrchestrationPanel />);
    expect(screen.getByText(/intake-agent/)).toBeTruthy();
    expect(screen.getByText(/story-planner-agent/)).toBeTruthy();
  });

  it('shows review actions when human_in_loop', async () => {
    useOrchestrationStore.setState({
      run: {
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
        feedback: null
      }
    });

    render(<OrchestrationPanel />);
    expect(screen.getByText('接受当前结果')).toBeTruthy();
    expect(screen.getByText('终止流程')).toBeTruthy();

    await userEvent.click(screen.getByText('接受当前结果'));
    expect(useOrchestrationStore.getState().performAction).toHaveBeenCalledWith({ action: 'accept_current' });
  });

  it('shows delivery info when delivered', () => {
    useOrchestrationStore.setState({
      run: {
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
        feedback: { feedbackId: 'fb_123', createdAt: '2026-04-24T00:00:00Z', assetPatches: [], memo: '无审核记录' }
      }
    });

    render(<OrchestrationPanel />);
    expect(screen.getByText(/交付完成/)).toBeTruthy();
    expect(screen.getByText(/ver_123/)).toBeTruthy();
  });
});
