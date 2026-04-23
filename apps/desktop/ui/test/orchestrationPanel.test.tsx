import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestrationPanel } from '../src/features/orchestration/OrchestrationPanel';
import { useOrchestrationStore } from '../src/shared/store/orchestrationStore';

describe('OrchestrationPanel', () => {
  beforeEach(() => {
    useOrchestrationStore.setState({
      run: null,
      loading: false,
      error: null,
      startRun: vi.fn().mockResolvedValue(undefined),
      refreshRun: vi.fn().mockResolvedValue(undefined)
    });
  });

  it('starts the main chain from the panel', async () => {
    render(<OrchestrationPanel />);

    await userEvent.click(screen.getByRole('button', { name: 'Start Main Chain' }));

    expect(useOrchestrationStore.getState().startRun).toHaveBeenCalled();
  });
});
