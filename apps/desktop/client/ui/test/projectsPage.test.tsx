import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from '../src/pages/projects/ProjectsPage';
import { useAppStore } from '../src/shared/store/appStore';

describe('ProjectsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      resolvedLocale: 'en-US',
      currentProject: null,
      recentProjects: [
        {
          projectId: '00001',
          name: 'Old Name',
          path: 'C:\\Projects\\Kept',
          type: 'novel',
          coverImage: 'C:\\Projects\\Kept\\cover.png',
        },
        {
          projectId: '00002',
          name: 'Deleted',
          path: 'C:\\Projects\\Deleted',
          type: 'script',
        },
      ],
    } as any);

    (window as any).orisonDesktop = {
      pathExists: vi.fn(async (path: string) => path !== 'C:\\Projects\\Deleted'),
      loadProjectMeta: vi.fn(async (path: string) => {
        if (path !== 'C:\\Projects\\Kept') return null;
        return {
          projectId: '00999',
          name: 'Fresh Name',
          type: 'script',
          coverImage: 'C:\\Projects\\Kept\\cover.png',
        };
      }),
      pickProjectDirectory: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('refreshes recent projects, removes missing directories, and syncs project metadata', async () => {
    render(<ProjectsPage />);

    await waitFor(() => expect(screen.getByText('Fresh Name')).toBeTruthy());

    expect(screen.queryByText('Deleted')).toBeNull();
    expect(useAppStore.getState().recentProjects).toEqual([
      {
        projectId: '00999',
        name: 'Fresh Name',
        path: 'C:\\Projects\\Kept',
        type: 'script',
        coverImage: 'C:\\Projects\\Kept\\cover.png',
      },
    ]);
  });

  it('refreshes when the refresh button is clicked', async () => {
    render(<ProjectsPage />);

    await waitFor(() => expect(screen.getByText('Fresh Name')).toBeTruthy());
    vi.mocked(window.orisonDesktop.pathExists).mockClear();

    await userEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    expect(window.orisonDesktop.pathExists).toHaveBeenCalledWith('C:\\Projects\\Kept');
  });
});
