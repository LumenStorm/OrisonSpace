import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import type { ProjectMeta } from '../../shared/store/appStore';

export function ProjectsPage() {
  const { openProject, resolvedLocale } = useAppStore();
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
    if (meta) {
      openProject({
        name: (meta.name as string) || dir.split(/[\\/]/).pop() || 'Project',
        path: dir,
        type: (meta.type as 'novel' | 'script') || 'script',
        coverImage: (meta.coverImage as string) || undefined,
      });
    } else {
      openProject({ name: dir.split(/[\\/]/).pop() || 'Project', path: dir, type: 'script' });
    }
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
