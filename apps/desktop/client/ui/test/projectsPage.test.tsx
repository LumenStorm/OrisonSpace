import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from '../src/pages/projects/ProjectsPage';
import { useAppStore } from '../src/shared/store/appStore';
import { useConfirmStore } from '../src/shared/store/confirmStore';
import { useToastStore } from '../src/shared/store/toastStore';

describe('ProjectsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfirmStore.setState({ requestConfirm: vi.fn().mockResolvedValue(true) } as any);
    useToastStore.setState({ toasts: [], showToast: vi.fn() } as any);
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
      listRegisteredProjects: vi.fn(async () => [
        {
          projectId: '00001',
          name: 'Old Name',
          path: 'C:\\Projects\\Kept',
          type: 'novel',
          coverImage: 'C:\\Projects\\Kept\\cover.png',
          createdAt: '2026-07-17T00:00:00.000Z',
          updatedAt: '2026-07-17T00:00:00.000Z',
        },
        {
          projectId: '00002',
          name: 'Deleted',
          path: 'C:\\Projects\\Deleted',
          type: 'script',
          createdAt: '2026-07-17T00:00:00.000Z',
          updatedAt: '2026-07-17T00:00:00.000Z',
        },
      ]),
      pickProjectDirectory: vi.fn(),
      duplicateProject: vi.fn(async (_path: string, name: string) => ({
        ok: true,
        project: {
          projectId: '00003',
          name,
          path: `C:\\Projects\\${name}`,
          type: 'script',
          createdAt: '2026-07-17T00:00:00.000Z',
          updatedAt: '2026-07-17T00:00:00.000Z',
        },
      })),
      renameProject: vi.fn(async (path: string, name: string) => ({
        ok: true,
        project: {
          projectId: '00999',
          name,
          path,
          type: 'script',
          coverImage: 'C:\\Projects\\Kept\\cover.png',
          createdAt: '2026-07-17T00:00:00.000Z',
          updatedAt: '2026-07-17T00:00:00.000Z',
        },
      })),
      deleteProject: vi.fn(async () => ({ ok: true })),
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

  it('drops unverified local cache entries when the trusted registry is available', async () => {
    vi.mocked(window.orisonDesktop.listRegisteredProjects).mockResolvedValue([]);

    render(<ProjectsPage />);

    await waitFor(() => expect(useAppStore.getState().recentProjects).toEqual([]));
    expect(screen.queryByText('Old Name')).toBeNull();
    expect(screen.queryByText('Fresh Name')).toBeNull();
  });

  it('opens duplicate, rename, and delete actions from the project context menu', async () => {
    render(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText('Fresh Name')).toBeTruthy());

    const projectCard = screen.getByRole('button', { name: /Fresh Name/i });
    fireEvent.contextMenu(projectCard, {
      clientX: 120,
      clientY: 80,
    });

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveStyle({ left: '120px', top: '80px' });
    expect(screen.getByRole('menuitem', { name: 'Duplicate Project' })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'Rename Project' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Delete Project' })).toHaveClass('ctx-menu-item-danger');

    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(projectCard).toHaveFocus();
  });

  it('duplicates a project with the default copy name and adds the returned project', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText('Fresh Name')).toBeTruthy());

    fireEvent.contextMenu(screen.getByRole('button', { name: /Fresh Name/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate Project' }));

    const input = screen.getByRole('textbox', { name: 'Copy name' });
    expect(input).toHaveValue('Fresh Name Copy');
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    await waitFor(() => {
      expect(window.orisonDesktop.duplicateProject).toHaveBeenCalledWith(
        'C:\\Projects\\Kept',
        'Fresh Name Copy',
      );
    });
    expect(useAppStore.getState().recentProjects[0]).toMatchObject({
      projectId: '00003',
      name: 'Fresh Name Copy',
      path: 'C:\\Projects\\Fresh Name Copy',
    });
    expect(useToastStore.getState().showToast).toHaveBeenCalledWith(
      'Duplicated project “Fresh Name Copy”',
      'success',
    );
  });

  it('renames a project through the context menu and replaces the cached card metadata', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText('Fresh Name')).toBeTruthy());

    fireEvent.contextMenu(screen.getByRole('button', { name: /Fresh Name/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename Project' }));

    const input = screen.getByRole('textbox', { name: 'Project name' });
    await user.clear(input);
    await user.type(input, 'Renamed Story');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(screen.getByText('Renamed Story')).toBeTruthy());
    expect(window.orisonDesktop.renameProject).toHaveBeenCalledWith(
      'C:\\Projects\\Kept',
      'Renamed Story',
    );
    expect(useAppStore.getState().recentProjects).toEqual([
      expect.objectContaining({
        projectId: '00999',
        name: 'Renamed Story',
        path: 'C:\\Projects\\Kept',
      }),
    ]);
  });

  it('does not delete a project when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const requestConfirm = vi.fn().mockResolvedValue(false);
    useConfirmStore.setState({ requestConfirm } as any);
    render(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText('Fresh Name')).toBeTruthy());

    fireEvent.contextMenu(screen.getByRole('button', { name: /Fresh Name/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Project' }));

    await waitFor(() => expect(requestConfirm).toHaveBeenCalledWith({
      title: 'Delete Project',
      message: 'Delete project “Fresh Name”? Its folder will be moved to the system recycle bin.',
      confirmLabel: 'Delete Project',
      cancelLabel: 'Cancel',
      variant: 'danger',
    }));
    expect(window.orisonDesktop.deleteProject).not.toHaveBeenCalled();
    expect(useAppStore.getState().recentProjects).toHaveLength(1);
  });

  it('deletes a confirmed project and removes it from the recent-project cache', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText('Fresh Name')).toBeTruthy());

    fireEvent.contextMenu(screen.getByRole('button', { name: /Fresh Name/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Project' }));

    await waitFor(() => {
      expect(window.orisonDesktop.deleteProject).toHaveBeenCalledWith('C:\\Projects\\Kept');
      expect(useAppStore.getState().recentProjects).toEqual([]);
    });
    expect(useToastStore.getState().showToast).toHaveBeenCalledWith(
      'Deleted project “Fresh Name”',
      'success',
    );
  });
});
