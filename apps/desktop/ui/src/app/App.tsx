import { useAppStore } from '../shared/store/appStore';
import { TopBar } from '../features/top-bar/TopBar';
import { AuthPage } from '../pages/auth/AuthPage';
import { ProjectsPage } from '../pages/projects/ProjectsPage';
import { WorkspacePage } from '../pages/workspace/WorkspacePage';

export function App() {
  const token = useAppStore((s) => s.token);
  const currentProject = useAppStore((s) => s.currentProject);

  const minimal = !token;

  return (
    <>
      <TopBar minimal={minimal} />
      {!token ? <AuthPage /> : !currentProject ? <ProjectsPage /> : <WorkspacePage />}
    </>
  );
}
