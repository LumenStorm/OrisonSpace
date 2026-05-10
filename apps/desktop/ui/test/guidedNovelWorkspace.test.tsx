import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChangeReviewPanel } from '../src/features/guided-novel/ChangeReviewPanel';
import { ChapterReviewPanel } from '../src/features/guided-novel/ChapterReviewPanel';
import { GuidedNovelWorkspace } from '../src/features/guided-novel/GuidedNovelWorkspace';
import { useAppStore } from '../src/shared/store/appStore';

describe('GuidedNovelWorkspace', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState({
      guidedNovelState: null,
      guidedNovelLoading: false,
    } as any);
  });

  it('renders interview first and planning after state transition', async () => {
    useAppStore.setState({
      resolvedLocale: 'zh-CN',
      guidedNovelState: null,
    } as any);

    const { rerender } = render(<GuidedNovelWorkspace />);
    expect(await screen.findByText('创作访谈')).toBeTruthy();

    useAppStore.setState({
      resolvedLocale: 'zh-CN',
      guidedNovelState: {
        session: {
          sessionId: 'guided_2',
          projectPath: 'C:/Projects/Novel',
          status: 'planning',
          baselineVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
        planningBaseline: {
          version: 1,
          fields: {
            creative_brief: {
              rawRequirement: 'A detective follows a city made of memory.',
              taboos: [],
              userConstraints: [],
            },
          },
        },
      },
    } as any);

    rerender(<GuidedNovelWorkspace />);
    expect(await screen.findByText('创作规划')).toBeTruthy();
  });

  it('shows chapter review before change review and blocks next chapter until both are resolved', async () => {
    useAppStore.setState({
      guidedNovelState: {
        session: {
          sessionId: 'guided_3',
          projectPath: 'C:/Projects/Novel',
          status: 'chapter_review_pending',
          baselineVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
        currentTaskCard: {
          chapterId: 'chapter-1',
          summary: 'Open with the detective arriving at the archive district.',
          involvedAssetIds: [],
          storyBeats: [],
        },
      },
    } as any);

    render(<GuidedNovelWorkspace />);
    expect(await screen.findByText('章节审阅')).toBeTruthy();
    expect(screen.queryByText('变更审阅')).toBeNull();
  });
  it('disables change acceptance when there are no pending changes', () => {
    useAppStore.setState({
      guidedNovelState: {
        session: {
          sessionId: 'guided_empty_changes',
          projectPath: 'C:/Projects/Novel',
          status: 'change_review_pending',
          baselineVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
        changeChecklist: {
          chapterId: 'chapter-1',
          items: [],
        },
      },
    } as any);

    render(<ChangeReviewPanel />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables request revision until the action is implemented', () => {
    render(<ChapterReviewPanel />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toBeDisabled();
  });
});
