import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from '../src/app/App';
import { useAppStore } from '../src/shared/store/appStore';
import type { TaskAdapter } from '../src/shared/store/appStore';

const mockAdapter: TaskAdapter = {
  async submitTask(request) {
    return { taskId: request.taskId, status: 'queued' };
  },
  async getTaskResult(taskId) {
    return {
      taskId,
      status: 'completed',
      outputType: 'patch',
      outputPayload: {
        operations: [
          {
            op: 'replace' as const,
            path: 'story.acts[0].summary',
            value: 'Rewritten: Make the opening darker.'
          }
        ]
      },
      summary: 'Mock rewrite completed.',
      rationale: 'The mock adapter echoes the requested direction.',
      reviewHint: 'Confirm the patch targets the intended act.',
      retryable: true
    };
  }
};

describe('review flow', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentTask: null,
      acceptedPatches: [],
      taskAdapter: mockAdapter
    });
  });

  it('shows a completed task and applies the patch when accepted', async () => {
    render(<App />);

    const createTaskButton = await screen.findByRole('button', { name: 'Run AI Rewrite' });
    await userEvent.click(createTaskButton);

    const acceptButton = await screen.findByRole('button', { name: 'Accept Task Result' });
    await userEvent.click(acceptButton);

    expect(await screen.findByDisplayValue('Rewritten: Make the opening darker.')).toBeInTheDocument();
  });
});
