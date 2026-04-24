import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function ProjectsPage() {
  const { openProject, resolvedLocale } = useAppStore();
  const { t } = useI18n(resolvedLocale);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'novel' | 'script'>('novel');
  const [recentProjects] = useState([
    { name: 'Cold City', path: '/projects/cold-city', type: 'script' as const },
    { name: 'Summer Dream', path: '/projects/summer-dream', type: 'novel' as const },
  ]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    openProject({ name: newName.trim(), path: '', type: newType });
    setNewName('');
    setNewType('novel');
    setShowNew(false);
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

      {showNew && (
        <div className="topbar-new-dialog-overlay" onClick={() => setShowNew(false)}>
          <div className="topbar-new-dialog" onClick={(e) => e.stopPropagation()}>
            <input
              className="auth-input"
              type="text"
              placeholder={t('projects.projectName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="projects-type-selector">
              <span className="sidebar-settings-label">{t('projects.projectType')}</span>
              <div className="sidebar-settings-options">
                <button
                  type="button"
                  className={`sidebar-settings-option${newType === 'novel' ? ' is-active' : ''}`}
                  onClick={() => setNewType('novel')}
                >
                  {t('projects.typeNovel')}
                </button>
                <button
                  type="button"
                  className={`sidebar-settings-option${newType === 'script' ? ' is-active' : ''}`}
                  onClick={() => setNewType('script')}
                >
                  {t('projects.typeScript')}
                </button>
              </div>
            </div>
            <div className="topbar-new-dialog-actions">
              <button type="button" className="auth-submit" onClick={handleCreate}>{t('projects.create')}</button>
              <button type="button" className="projects-cancel" onClick={() => setShowNew(false)}>{t('projects.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
