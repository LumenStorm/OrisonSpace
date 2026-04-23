import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function ProjectsPage() {
  const { user, logout, openProject, resolvedLocale } = useAppStore();
  const { t } = useI18n(resolvedLocale);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [recentProjects] = useState([
    { name: 'Cold City', path: '/projects/cold-city' },
    { name: 'Summer Dream', path: '/projects/summer-dream' },
  ]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    openProject({ name: newName.trim(), path: '' });
    setNewName('');
    setShowNew(false);
  };

  const handleOpen = async () => {
    if (window.orisonDesktop?.pickProjectDirectory) {
      const dir = await window.orisonDesktop.pickProjectDirectory();
      if (dir) openProject({ name: dir.split(/[\\/]/).pop() || 'Project', path: dir });
    }
  };

  return (
    <div className="projects-page">
      <header className="projects-header">
        <div className="projects-header-left">
          <h1 className="projects-brand">{t('projects.brand')}</h1>
          {user && <span className="projects-user">{user.displayName || user.email}</span>}
        </div>
        <button type="button" className="projects-logout" onClick={logout}>
          <span className="material-symbols-outlined" aria-hidden="true">logout</span>
          {t('projects.logout')}
        </button>
      </header>

      <main className="projects-body">
        <div className="projects-actions">
          <button type="button" className="projects-action-card" onClick={() => setShowNew(true)}>
            <span className="material-symbols-outlined" aria-hidden="true">add_circle</span>
            <span>{t('projects.newProject')}</span>
          </button>
          <button type="button" className="projects-action-card" onClick={handleOpen}>
            <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
            <span>{t('projects.openProject')}</span>
          </button>
        </div>

        {showNew && (
          <div className="projects-new-dialog">
            <input
              className="auth-input"
              type="text"
              placeholder={t('projects.projectName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="projects-new-actions">
              <button type="button" className="auth-submit" onClick={handleCreate}>{t('projects.create')}</button>
              <button type="button" className="projects-cancel" onClick={() => setShowNew(false)}>{t('projects.cancel')}</button>
            </div>
          </div>
        )}

        <section className="projects-recent">
          <h2 className="projects-section-title">{t('projects.recentProjects')}</h2>
          <div className="projects-list">
            {recentProjects.map((p) => (
              <button
                key={p.path}
                type="button"
                className="projects-item"
                onClick={() => openProject(p)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">movie_creation</span>
                <div className="projects-item-info">
                  <span className="projects-item-name">{p.name}</span>
                  <span className="projects-item-path">{p.path}</span>
                </div>
                <span className="material-symbols-outlined projects-item-arrow" aria-hidden="true">chevron_right</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
