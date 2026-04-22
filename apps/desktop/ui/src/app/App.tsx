import { useAppStore } from '../shared/store/appStore';
import { WelcomePage } from '../pages/welcome/WelcomePage';
import { WorkspacePage } from '../pages/workspace/WorkspacePage';

export function App() {
  const currentProject = useAppStore((s) => s.currentProject);

  return currentProject ? <WorkspacePage /> : <WelcomePage />;
}
