import { useAppStore } from '../shared/store/appStore';
import { AuthPage } from '../pages/auth/AuthPage';
import { ProjectsPage } from '../pages/projects/ProjectsPage';
import { WorkspacePage } from '../pages/workspace/WorkspacePage';

export function App() {
  const token = useAppStore((s) => s.token);
  const currentProject = useAppStore((s) => s.currentProject);

  if (!token) return <AuthPage />;
  if (!currentProject) return <ProjectsPage />;
  return <WorkspacePage />;
}
