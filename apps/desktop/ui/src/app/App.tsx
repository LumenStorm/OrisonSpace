import { useEffect } from 'react';
import { useAppStore } from '../shared/store/appStore';
import { TopBar } from '../features/top-bar/TopBar';
import { ProjectsPage } from '../pages/projects/ProjectsPage';
import { WorkspacePage } from '../pages/workspace/WorkspacePage';
import { CommandPalette } from '../features/command-palette/CommandPalette';
import { useToolEvents } from '../shared/hooks/useToolEvents';

export function App() {
  const currentProject = useAppStore((s) => s.currentProject);
  const loadUserPreferences = useAppStore((s) => s.loadUserPreferences);
  const loadModelConfig = useAppStore((s) => s.loadModelConfig);
  const loadAppVersion = useAppStore((s) => s.loadAppVersion);

  useToolEvents();

  useEffect(() => {
    void loadUserPreferences();
    void loadModelConfig();
    void loadAppVersion();
  }, [loadUserPreferences, loadModelConfig, loadAppVersion]);

  return (
    <>
      <TopBar />
      {!currentProject ? <ProjectsPage /> : <WorkspacePage />}
      <CommandPalette />
    </>
  );
}
