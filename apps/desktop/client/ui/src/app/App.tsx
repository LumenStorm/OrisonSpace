import { useEffect } from 'react';
import { useAppStore } from '../shared/store/appStore';
import { TopBar } from '../features/top-bar/TopBar';
import { ProjectsPage } from '../pages/projects/ProjectsPage';
import { WorkspacePage } from '../pages/workspace/WorkspacePage';
import { CommandPalette } from '../features/command-palette/CommandPalette';
import { Toast } from '../shared/components/Toast';
import { ConfirmDialog } from '../shared/components/ConfirmDialog';
import { useToolEvents } from '../shared/hooks/useToolEvents';
import { useCloseGuard } from '../shared/hooks/useCloseGuard';

export function App() {
  const currentProject = useAppStore((s) => s.currentProject);
  const loadUserPreferences = useAppStore((s) => s.loadUserPreferences);
  const loadModelConfig = useAppStore((s) => s.loadModelConfig);
  const loadAppVersion = useAppStore((s) => s.loadAppVersion);
  const subscribeUpdateEvents = useAppStore((s) => s.subscribeUpdateEvents);
  const restoreLastProject = useAppStore((s) => s.restoreLastProject);

  useToolEvents();
  useCloseGuard();

  useEffect(() => {
    void loadUserPreferences();
    void loadModelConfig();
    void loadAppVersion();
    restoreLastProject();
    subscribeUpdateEvents();
  }, [loadUserPreferences, loadModelConfig, loadAppVersion, restoreLastProject, subscribeUpdateEvents]);

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <TopBar />
      {!currentProject ? <ProjectsPage /> : <WorkspacePage />}
      <CommandPalette />
      <Toast />
      <ConfirmDialog />
    </>
  );
}
