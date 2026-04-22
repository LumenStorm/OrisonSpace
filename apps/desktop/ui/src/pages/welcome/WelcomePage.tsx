import { useAppStore } from '../../shared/store/appStore';

export function WelcomePage() {
  const openProject = useAppStore((s) => s.openProject);

  const handleOpen = async () => {
    const dir = await window.orisonDesktop?.pickProjectDirectory?.();
    if (dir) {
      openProject({ name: dir.split(/[\\/]/).pop() || 'Untitled', path: dir });
    }
  };

  const handleNew = () => {
    openProject({ name: 'Untitled Project', path: '' });
  };

  return (
    <div className="welcome-page">
      <div className="welcome-card">
        <h1 className="welcome-brand">Orison Space</h1>
        <p className="welcome-tagline">AI-driven filmmaking, from idea to screen.</p>
        <div className="welcome-actions">
          <button type="button" className="welcome-btn welcome-btn-primary" onClick={handleNew}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            New Project
          </button>
          <button type="button" className="welcome-btn welcome-btn-secondary" onClick={handleOpen}>
            <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
            Open Project
          </button>
        </div>
        <div className="welcome-recent">
          <h3 className="welcome-recent-title">Recent Projects</h3>
          <p className="welcome-recent-empty">No recent projects</p>
        </div>
      </div>
    </div>
  );
}
