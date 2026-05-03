import { render, screen } from '@testing-library/react';
import { within } from '@testing-library/react';
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
        projectId: '00001',
        name: 'Cold City',
        path: 'C:/Projects/ColdCity',
        type: 'novel'
      },
      currentTask: {
        request: {
          projectId: '00001',
          targetId: 'act_1',
          assetIds: [],
          type: 'outline.rewrite',
          name: 'Rewrite Current Passage',
          description: 'Make the opening darker.',
          input: 'Make the opening darker.'
        },
        result: {
          taskId: '20260427214530123_48321',
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
        }
      },
      acceptedPatches: [],
      taskAdapter: mockAdapter
    });
  });

  it('shows a completed task result and surfaces the accepted patch in the editor area', async () => {
    render(<App />);

    const tabs = screen.getByRole('navigation', { name: 'Bottom Panel Tabs' });
    await userEvent.click(within(tabs).getAllByRole('button')[1]);

    const acceptButton = await screen.findByRole('button', { name: /Accept Task Result|tasks\.accept/ });
    await userEvent.click(acceptButton);

    expect(await screen.findByDisplayValue('Rewritten: Make the opening darker.')).toBeInTheDocument();
  });
});
