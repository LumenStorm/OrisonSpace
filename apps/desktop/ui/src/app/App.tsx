import { useEffect } from 'react';
import { useAppStore } from '../shared/store/appStore';
import { TopBar } from '../features/top-bar/TopBar';
import { AuthPage } from '../pages/auth/AuthPage';
import { ProjectsPage } from '../pages/projects/ProjectsPage';
import { WorkspacePage } from '../pages/workspace/WorkspacePage';
import { AUTH_EXPIRED_EVENT } from '../shared/api/session';

export function App() {
  const token = useAppStore((s) => s.token);
  const currentProject = useAppStore((s) => s.currentProject);
  const logout = useAppStore((s) => s.logout);
  const loadUserPreferences = useAppStore((s) => s.loadUserPreferences);
  const loadModelConfig = useAppStore((s) => s.loadModelConfig);

  useEffect(() => {
    void loadUserPreferences();
    void loadModelConfig();
  }, [loadUserPreferences, loadModelConfig]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, [logout]);

  const minimal = !token;

  return (
    <>
      <TopBar minimal={minimal} />
      {!token ? <AuthPage /> : !currentProject ? <ProjectsPage /> : <WorkspacePage />}
    </>
  );
}
