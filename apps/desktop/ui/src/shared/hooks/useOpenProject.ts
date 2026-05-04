import { useCallback } from 'react';
import { useAppStore, type ProjectMeta } from '../store/appStore';
import { ensureProjectRegistration } from '../api/projects';

/**
 * Shared hook for "Open Project" flow:
 * 1. Pick a directory through the desktop shell.
 * 2. Load (or fall back to) project metadata.
 * 3. Register the project with the server when it has no projectId.
 * 4. Persist the registered projectId back to project.json.
 * 5. Push the result into the app store.
 *
 * Used by both `ProjectsPage` and `TopBar` to keep the open-project behavior consistent.
 */
export function useOpenProject(): () => Promise<void> {
  const token = useAppStore((s) => s.token);
  const openProject = useAppStore((s) => s.openProject);

  return useCallback(async () => {
    const dir = await window.orisonDesktop?.pickProjectDirectory();
    if (!dir) return;

    const meta = await window.orisonDesktop?.loadProjectMeta(dir);
    const project: ProjectMeta = meta ? {
      projectId: typeof meta.projectId === 'string' ? meta.projectId : undefined,
      name: (meta.name as string) || dir.split(/[\\/]/).pop() || 'Project',
      path: dir,
      type: (meta.type as 'novel' | 'script') || 'script',
      coverImage: (meta.coverImage as string) || undefined,
    } : {
      name: dir.split(/[\\/]/).pop() || 'Project',
      path: dir,
      type: 'script',
    };

    if (!project.projectId && token) {
      try {
        project.projectId = await ensureProjectRegistration({ token, project });
        await window.orisonDesktop?.saveProjectMeta(dir, {
          ...(meta ?? {}),
          name: project.name,
          type: project.type,
          coverImage: project.coverImage ?? null,
          projectId: project.projectId,
        });
      } catch {
        // Keep the local project open even when registration is temporarily unavailable.
      }
    }

    openProject(project);
  }, [token, openProject]);
}
