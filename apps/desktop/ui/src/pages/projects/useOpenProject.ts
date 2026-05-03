import { ensureProjectRegistration } from '../../shared/api/projects';
import type { ProjectMeta } from '../../shared/store/appStore';

type UseOpenProjectInput = {
  token: string | null;
  openProject: (project: ProjectMeta) => void;
};

export function useOpenProject({ token, openProject }: UseOpenProjectInput) {
  return async () => {
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
  };
}
