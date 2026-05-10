import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GuidedNovelWorkspace } from '../src/features/guided-novel/GuidedNovelWorkspace';
import { useAppStore } from '../src/shared/store/appStore';

describe('GuidedNovel Chinese copy', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders Chinese-first workflow labels in planning state', async () => {
    useAppStore.setState({
      resolvedLocale: 'zh-CN',
      guidedNovelState: {
        session: {
          sessionId: 'guided_zh_1',
          projectPath: 'C:/Projects/Novel',
          status: 'planning',
          baselineVersion: 1,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        },
        planningBaseline: {
          version: 1,
          fields: {},
        },
      },
    } as any);

    render(<GuidedNovelWorkspace />);
    expect(await screen.findByText('创作规划')).toBeTruthy();
    expect(screen.getByText('确认创作基线')).toBeTruthy();
  });
});
