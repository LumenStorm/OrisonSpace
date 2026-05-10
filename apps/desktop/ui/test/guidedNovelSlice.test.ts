import type { GuidedChangeChecklist } from '@orison/shared-contracts';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../src/shared/store/appStore';

describe('guidedNovelSlice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useAppStore.setState({
      currentProject: null,
      creativeFields: {},
      guidedNovelState: null,
      guidedNovelLoading: false,
      guidedNovelError: null,
    } as any);
    (window as any).orisonDesktop = undefined;
  });

  it('moves from interview to planning state after accepting planning readiness', async () => {
    useAppStore.setState({
      guidedNovelState: {
        session: {
          sessionId: 'guided_1',
          projectPath: 'C:/Projects/Novel',
          status: 'interviewing',
          baselineVersion: 0,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
        interviewDraft: {
          concept: {},
          cast: {},
          world: {},
          plot: {},
          constraints: {},
          confidence: {
            concept: 1,
            cast: 1,
            world: 1,
            plot: 1,
            constraints: 1,
            canEnterPlanning: true,
          },
        },
      },
    } as any);

    useAppStore.getState().enterGuidedPlanning();

    expect(useAppStore.getState().guidedNovelState?.session?.status).toBe('planning');
  });

  it('applies accepted change review items into creative fields', async () => {
    const checklist: GuidedChangeChecklist = {
      chapterId: 'chapter-2',
      items: [
        {
          id: 'change_1',
          type: 'new_character',
          sourceChapterId: 'chapter-2',
          targetIds: [],
          suggestedOperation: 'create',
          confidence: 'high',
          payload: {
            id: 'char_shao_yun',
            type: 'character',
            name: 'Shao Yun',
          },
          decision: 'accepted',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        session: {
          sessionId: 'guided_4',
          projectPath: 'C:/Projects/Novel',
          status: 'ready_to_write',
          baselineVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
        changeChecklist: checklist,
      }),
    })) as any);

    useAppStore.setState({
      currentProject: null,
      creativeFields: {
        asset_cards: [],
      },
      guidedNovelState: {
        session: {
          sessionId: 'guided_4',
          projectPath: 'C:/Projects/Novel',
          status: 'change_review_pending',
          baselineVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
        changeChecklist: checklist,
      },
    } as any);

    await useAppStore.getState().acceptGuidedChanges();

    const cards = useAppStore.getState().creativeFields.asset_cards as Array<{ id: string }> | undefined;
    expect(cards?.some((item) => item.id === 'char_shao_yun')).toBe(true);
  });

  it('starts a session before submitting the first interview answer', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {
            sessionId: 'guided_cold_start',
            projectPath: 'C:/Projects/Novel',
            status: 'interviewing',
            baselineVersion: 0,
            createdAt: '2026-05-10T00:00:00.000Z',
            updatedAt: '2026-05-10T00:00:00.000Z',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {
            sessionId: 'guided_cold_start',
            projectPath: 'C:/Projects/Novel',
            status: 'planning',
            baselineVersion: 1,
            createdAt: '2026-05-10T00:00:00.000Z',
            updatedAt: '2026-05-10T00:01:00.000Z',
          },
          planningBaseline: {
            version: 1,
            fields: {},
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock as any);
    useAppStore.setState({
      currentProject: {
        name: 'Memory City',
        path: 'C:/Projects/Novel',
        type: 'novel',
      },
      guidedNovelState: null,
    } as any);

    await useAppStore.getState().submitGuidedNovelAnswer('A city made of memory.');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/guided-novel/sessions');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/v1/guided-novel/sessions/guided_cold_start/interview');
    expect(useAppStore.getState().guidedNovelState?.session?.status).toBe('planning');
  });

  it('uses restored agent state after opening a project with persisted guided state', async () => {
    const persistedState = {
      session: {
        sessionId: 'guided_restore',
        projectPath: 'C:/Projects/Novel',
        status: 'interviewing',
        baselineVersion: 0,
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        session: {
          ...persistedState.session,
          status: 'planning',
          baselineVersion: 1,
          updatedAt: '2026-05-10T00:02:00.000Z',
        },
        planningBaseline: {
          version: 1,
          fields: {},
        },
      }),
    })) as any);
    (window as any).orisonDesktop = {
      loadGuidedNovelState: vi.fn(async () => persistedState),
    };

    useAppStore.getState().openProject({
      name: 'Memory City',
      path: 'C:/Projects/Novel',
      type: 'novel',
    });

    await waitFor(() => {
      expect(useAppStore.getState().guidedNovelState?.session?.status).toBe('planning');
    });
  });
});
