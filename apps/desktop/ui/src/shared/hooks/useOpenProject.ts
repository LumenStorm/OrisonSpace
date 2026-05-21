import { useCallback } from 'react';
import { useAppStore, type ProjectMeta } from '../store/appStore';
import { ensureProjectRegistration } from '../api/projects';

export function useOpenProject(): () => Promise<void> {
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
      logline: (meta.logline as string) || undefined,
      synopsis: (meta.synopsis as string) || undefined,
      genre: (meta.genre as string) || undefined,
      theme: (meta.theme as string) || undefined,
      writingStyle: (meta.writing_style as string) || undefined,
      tone: (meta.tone as string) || undefined,
      coverImage: (meta.coverImage as string) || undefined,
    } : {
      name: dir.split(/[\\/]/).pop() || 'Project',
      path: dir,
      type: 'script',
    };

    if (!project.projectId) {
      try {
        project.projectId = await ensureProjectRegistration({ project });
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
  }, [openProject]);
}
