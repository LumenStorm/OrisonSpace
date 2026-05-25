import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
      agentContinuations: [],
      continuationSourceSessionId: 'session-1',
      restoreLatestSkillContinuation: vi.fn().mockResolvedValue(undefined),
      rerunLatestSkillContinuation: vi.fn().mockResolvedValue(undefined),
      loadAgentContinuations: vi.fn().mockResolvedValue(undefined),
      restoreAgentContinuation: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads project skills and executes one from the panel', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        skills: [
          { name: 'story-setup', description: 'Prepare story context', location: 'I:/echo/project/.orison/skills/story-setup', format: 'manifest', source: 'project' },
          { name: 'scene-expander', description: 'Expand scenes', location: 'I:/echo/skills/scene-expander', format: 'manifest', source: 'external' },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        skill: 'story-setup',
        status: 'completed',
        outputs: ['Prepare the story context.'],
        continuation: {
          continuationId: 'cont-latest',
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

    expect(screen.getByText(/Project skill|agent\.skillSourceProject/i)).toBeInTheDocument();
    expect(screen.getByText(/External skill|agent\.skillSourceExternal/i)).toBeInTheDocument();

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

  it('shows continuation restore workbench actions and forwards restore/rerun events', async () => {
    useAppStore.setState({
      latestSkillContinuation: {
        continuationId: 'cont-latest',
        sessionId: 'session-1',
        compacted: {
          sessionId: 'session-1',
          summary: 'Recovered story setup context',
          tail: [
            { id: 'm1', role: 'assistant', content: 'Context packed.', createdAt: 1 },
          ],
        },
        workflowState: {
          activeSkill: 'story-setup',
          checkpoints: ['outline-ready', 'world-ready'],
        },
      },
    } as any);

    render(<AgentPanel />);

    expect(screen.getAllByText(/Continuation ready|agent\.continuationReady/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Recovered story setup context/)).toBeInTheDocument();
    expect(screen.getByText(/outline-ready/)).toBeInTheDocument();
    expect(screen.getByText(/world-ready/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Restore context|agent\.restoreContinuation/i }));
    expect(useAppStore.getState().restoreLatestSkillContinuation).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Rerun from continuation|agent\.rerunContinuation/i }));
    expect(useAppStore.getState().rerunLatestSkillContinuation).toHaveBeenCalled();
  });

  it('shows recent resumable runs and restores one through the workbench', async () => {
    useAppStore.setState({
      latestSkillContinuation: {
        continuationId: 'cont-latest',
        sessionId: 'session-1',
        compacted: {
          sessionId: 'session-1',
          summary: 'Recovered story setup context',
          tail: [],
        },
        workflowState: {
          activeSkill: 'story-setup',
          checkpoints: ['outline-ready'],
        },
      },
      agentContinuations: [
        {
          continuationId: 'cont-1',
          sessionId: 'session-1',
          createdAt: 1,
          summary: 'Recovered story setup context',
          workflowState: {
            activeSkill: 'story-setup',
            checkpoints: ['outline-ready'],
          },
        },
      ],
    } as any);

    render(<AgentPanel />);

    expect(useAppStore.getState().loadAgentContinuations).toHaveBeenCalled();
    const recentRunsCard = screen.getByText(/Recent resumable runs|agent\.recentContinuations/i).closest('.agent-workbench-card');
    expect(recentRunsCard).toBeTruthy();
    expect(within(recentRunsCard as HTMLElement).getByText(/Recovered story setup context/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Restore run|agent\.restoreRun/i }));
    expect(useAppStore.getState().restoreAgentContinuation).toHaveBeenCalledWith('cont-1');
  });
});
