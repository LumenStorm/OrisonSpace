import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import type { ProjectMeta } from '../../shared/store/appStore';
import { ensureProjectRegistration } from '../../shared/api/projects';

export function ProjectsPage() {
  const { openProject, resolvedLocale, token, user, logout } = useAppStore();
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

  const hasRecent = recentProjects.length > 0;

  return (
    <div className="projects-page">
      {/* ── Header ── */}
      <div className="projects-header">
        <span className="projects-header-brand">{t('projects.brand')}</span>
        <div className="projects-header-user">
          {user?.displayName && <span className="projects-header-name">{user.displayName}</span>}
          {user?.email && <span className="projects-header-email">{user.email}</span>}
          <button type="button" className="projects-header-logout" onClick={logout}>
            <span className="material-symbols-outlined" aria-hidden="true">logout</span>
            <span>{t('projects.logout')}</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="projects-grid-container">
        {hasRecent ? (
          <>
            <h2 className="projects-section-title">{t('projects.recentProjects')}</h2>
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
          </>
        ) : (
          <div className="projects-empty">
            <span className="material-symbols-outlined projects-empty-icon" aria-hidden="true">folder_open</span>
            <h2 className="projects-empty-title">{t('projects.emptyTitle')}</h2>
            <p className="projects-empty-hint">{t('projects.emptyHint')}</p>
            <div className="projects-empty-actions">
              <button type="button" className="auth-submit" onClick={() => setShowNew(true)}>
                {t('projects.newProject')}
              </button>
              <button type="button" className="auth-submit projects-empty-open" onClick={handleOpen}>
                {t('projects.openProject')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
