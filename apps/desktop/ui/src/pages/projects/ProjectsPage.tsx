import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import type { ProjectMeta } from '../../shared/store/appStore';
import { ensureProjectRegistration } from '../../shared/api/projects';

export function ProjectsPage() {
  const { openProject, resolvedLocale, token } = useAppStore();
  const { t } = useI18n(resolvedLocale);
  const [showNew, setShowNew] = useState(false);
  const [recentProjects] = useState<ProjectMeta[]>([
    { name: 'Cold City', path: '/projects/cold-city', type: 'script' },
    { name: 'Summer Dream', path: '/projects/summer-dream', type: 'novel' },
  ]);

  const handleOpen = async () => {
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

  return (
    <div className="projects-page">
      <div className="projects-grid-container">
        <div className="projects-grid">
          <button
            type="button"
            className="projects-grid-card projects-grid-card-new"
            onClick={() => setShowNew(true)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>
            <span>{t('projects.newProject')}</span>
          </button>

          <button
            type="button"
            className="projects-grid-card projects-grid-card-new"
            onClick={handleOpen}
          >
            <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
            <span>{t('projects.openProject')}</span>
          </button>

          {recentProjects.map((p) => (
            <button
              key={p.path}
              type="button"
              className="projects-grid-card"
              onClick={() => openProject(p)}
            >
              {p.coverImage ? (
                <img src={`file://${p.coverImage}`} alt="" className="projects-grid-card-cover" />
              ) : (
                <span className="material-symbols-outlined projects-grid-card-icon" aria-hidden="true">movie_creation</span>
              )}
              <span className="projects-grid-card-name">{p.name}</span>
              <span className="projects-grid-card-type">{p.type === 'novel' ? t('projects.typeNovel') : t('projects.typeScript')}</span>
            </button>
          ))}
        </div>
      </div>

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
