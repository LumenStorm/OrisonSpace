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
      } catch {
        // Keep the local project open even when registration is temporarily unavailable.
      }
    }

    const metaBase = {
      ...(meta ?? {}),
      name: project.name,
      type: project.type,
      coverImage: project.coverImage ?? null,
    };

    // Initialize the project config (project.yaml) on import, mirroring create.
    try {
      if (project.projectId && project.projectId !== meta?.projectId) {
        // Obtained/changed a projectId → persist it (also creates the file if absent).
        await window.orisonDesktop?.saveProjectMeta(dir, { ...metaBase, projectId: project.projectId });
      } else {
        // Otherwise just guarantee the file exists, without rewriting or bumping
        // the version of an existing project.yaml.
        await window.orisonDesktop?.ensureProjectDocument(dir, metaBase);
      }
    } catch {
      // A failed write must not block opening the project.
    }

    openProject(project);
  }, [openProject]);
}
