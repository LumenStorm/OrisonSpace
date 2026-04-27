import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from '../src/app/App';
import { useAppStore } from '../src/shared/store/appStore';
import type { TaskAdapter } from '../src/shared/store/appStore';

const mockAdapter: TaskAdapter = {
  async submitTask() {
    return { taskId: '20260427214530123_48321', status: 'queued' };
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
      token: 'token_123',
      user: {
        id: 'user_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      currentProject: {
        name: 'Cold City',
        path: 'C:/Projects/ColdCity',
        type: 'novel'
      },
      currentTask: null,
      acceptedPatches: [],
      taskAdapter: mockAdapter
    });
  });

  it('shows a completed task and applies the patch when accepted', async () => {
    render(<App />);

    const promptInput = await screen.findByPlaceholderText('Describe how to refine the story outline...');
    await userEvent.type(promptInput, 'Make the opening darker.');

    const createTaskButton = await screen.findByRole('button', { name: 'Run AI Rewrite' });
    await userEvent.click(createTaskButton);

    const acceptButton = await screen.findByRole('button', { name: 'Accept Task Result' });
    await userEvent.click(acceptButton);

    expect(await screen.findByDisplayValue('Rewritten: Make the opening darker.')).toBeInTheDocument();
  });
});
