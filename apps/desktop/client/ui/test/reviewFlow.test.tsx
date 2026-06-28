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
      taskAdapter: mockAdapter,
      // The bottom panel (which hosts the "Bottom Panel Tabs" nav and the
      // Tasks tab where task results surface) only mounts when open.
      bottomPanelOpen: true,
      activeBottomTab: 'tasks',
    });
  });

  it('surfaces an accepted task-result patch in the editor area', async () => {
    // The editor pages (novel/script) mount AcceptedPatchesView, which renders
    // accepted patch operations as readonly inputs.
    useAppStore.setState({ activePage: 'script' } as any);

    render(<App />);

    // Bottom panel tabs nav is present (output / tasks) when the panel is open.
    const tabs = screen.getByRole('navigation', { name: 'Bottom Panel Tabs' });
    expect(within(tabs).getAllByRole('button').length).toBeGreaterThanOrEqual(2);

    // Accepting the completed task result moves its patch operations into
    // acceptedPatches, which AcceptedPatchesView surfaces in the editor.
    useAppStore.getState().acceptTaskResult();

    // Rendering the full <App/> (plus eager i18n YAML load) and the post-accept
    // re-render can exceed findBy's 1s default under heavy parallel full-suite
    // load, causing a load-dependent flake (passes isolated). Wait up to 4s —
    // still under the 5s testTimeout — so a slow render isn't a false failure.
    expect(
      await screen.findByDisplayValue('Rewritten: Make the opening darker.', undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
