import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';

export function ProjectsPage() {
  const { openProject, resolvedLocale } = useAppStore();
  const { t } = useI18n(resolvedLocale);
  const [showNew, setShowNew] = useState(false);
  const [recentProjects] = useState([
    { name: 'Cold City', path: '/projects/cold-city', type: 'script' as const },
    { name: 'Summer Dream', path: '/projects/summer-dream', type: 'novel' as const },
  ]);

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

          {recentProjects.map((p) => (
            <button
              key={p.path}
              type="button"
              className="projects-grid-card"
              onClick={() => openProject(p)}
            >
              <span className="material-symbols-outlined projects-grid-card-icon" aria-hidden="true">movie_creation</span>
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
