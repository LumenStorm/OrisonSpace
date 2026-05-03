import { useState } from 'react';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore, type ProjectMeta } from '../../shared/store/appStore';
import { ProjectCard } from './ProjectCard';
import { ProjectsEmptyState } from './ProjectsEmptyState';
import { useOpenProject } from './useOpenProject';

export function ProjectsPage() {
  const { openProject, resolvedLocale, token, user, logout } = useAppStore();
  const { t } = useI18n(resolvedLocale);
  const [showNew, setShowNew] = useState(false);
  const [recentProjects] = useState<ProjectMeta[]>([
    { name: 'Cold City', path: '/projects/cold-city', type: 'script' },
    { name: 'Summer Dream', path: '/projects/summer-dream', type: 'novel' },
  ]);
  const handleOpen = useOpenProject({ token, openProject });
  const hasRecent = recentProjects.length > 0;

  return (
    <div className="projects-page">
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

              {recentProjects.map((project) => (
                <ProjectCard
                  key={project.path}
                  project={project}
                  typeLabel={project.type === 'novel' ? t('projects.typeNovel') : t('projects.typeScript')}
                  onOpen={openProject}
                />
              ))}
            </div>
          </>
        ) : (
          <ProjectsEmptyState
            title={t('projects.emptyTitle')}
            hint={t('projects.emptyHint')}
            newLabel={t('projects.newProject')}
            openLabel={t('projects.openProject')}
            onNew={() => setShowNew(true)}
            onOpen={handleOpen}
          />
        )}
      </div>

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
