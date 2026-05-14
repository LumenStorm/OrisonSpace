import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPanel } from '../src/features/agent-panel/AgentPanel';
import { useAppStore } from '../src/shared/store/appStore';

describe('AgentPanel skills', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState({
      currentProject: {
        projectId: 'p1',
        name: 'Cold City',
        path: 'I:/echo/project',
        type: 'novel',
      },
      resolvedLocale: 'en-US',
      agentMessages: [],
      agentLoading: false,
      agentError: null,
      agentSessionId: 'session-1',
      agentSkills: [],
      agentSkillError: null,
      latestSkillContinuation: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads project skills and executes one from the panel', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        skills: [
          { name: 'story-setup', description: 'Prepare story context' },
          { name: 'scene-expander', description: 'Expand scenes' },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        skill: 'story-setup',
        status: 'completed',
        outputs: ['Prepare the story context.'],
        continuation: {
          sessionId: 'session-1',
          compacted: { sessionId: 'session-1', summary: '', tail: [] },
          workflowState: { activeSkill: 'story-setup', checkpoints: [] },
        },
      }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    render(<AgentPanel />);

    await waitFor(() => {
      expect(screen.getByText('story-setup')).toBeInTheDocument();
      expect(screen.getByText('scene-expander')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Run story-setup/i }));

    await waitFor(() => {
      expect(useAppStore.getState().latestSkillContinuation?.workflowState.activeSkill).toBe('story-setup');
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/v1/agent/skills?projectPath='),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/v1/agent/sessions/session-1/skills/story-setup/execute'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
