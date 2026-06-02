import { lazy, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SideNav } from '../../features/side-nav/SideNav';
import { AgentPanel } from '../../features/agent-panel/AgentPanel';
import { ResizeHandle } from '../../shared/components/ResizeHandle';
import { Tooltip } from '../../shared/components/Tooltip';
import { useAppStore } from '../../shared/store/appStore';
import { useProjectTreeResize, useAgentPanelResize } from '../../shared/hooks/usePanelResize';
import { ICON_RAIL_WIDTH } from '../../shared/constants';
import { StatusBar } from '../../features/status-bar/StatusBar';

const ProjectTree = lazy(() => import('../../features/project-tree/ProjectTree').then((m) => ({ default: m.ProjectTree })));
const SearchPanel = lazy(() => import('../../features/search-panel/SearchPanel').then((m) => ({ default: m.SearchPanel })));
const TimelinePanel = lazy(() => import('../../features/timeline/TimelinePanel').then((m) => ({ default: m.TimelinePanel })));
const OverviewPage = lazy(() => import('../../features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const OutlineEditor = lazy(() => import('../../features/editor/OutlineEditor').then((m) => ({ default: m.OutlineEditor })));
const ScriptEditorPage = lazy(() => import('../../features/editor/ScriptEditorPage').then((m) => ({ default: m.ScriptEditorPage })));
const StoryboardCanvas = lazy(() => import('../../features/editor/StoryboardCanvas').then((m) => ({ default: m.StoryboardCanvas })));
const ImageGenEditor = lazy(() => import('../../features/editor/ImageGenEditor').then((m) => ({ default: m.ImageGenEditor })));
const VideoEditor = lazy(() => import('../../features/editor/VideoEditor').then((m) => ({ default: m.VideoEditor })));
const AssetsPanel = lazy(() => import('../../features/assets/AssetsPanel').then((m) => ({ default: m.AssetsPanel })));
const FileTabBar = lazy(() => import('../../features/editor/FileTabBar').then((m) => ({ default: m.FileTabBar })));
const FileEditor = lazy(() => import('../../features/editor/FileEditor').then((m) => ({ default: m.FileEditor })));
const SplitFileEditor = lazy(() => import('../../features/editor/SplitFileEditor').then((m) => ({ default: m.SplitFileEditor })));

export function WorkspaceLayout() {
  const {
    activePage,
    projectTreeOpen, projectTreeWidth,
    activeSidebarPanel,
    agentPanelOpen, agentPanelWidth,
    toggleAgentPanel,
    hasOpenFiles,
    mainView,
    splitDirection, splitFilePath,
  } = useAppStore(useShallow((s) => ({
    activePage: s.activePage,
    projectTreeOpen: s.projectTreeOpen,
    projectTreeWidth: s.projectTreeWidth,
    activeSidebarPanel: s.activeSidebarPanel,
    agentPanelOpen: s.agentPanelOpen,
    agentPanelWidth: s.agentPanelWidth,
    toggleAgentPanel: s.toggleAgentPanel,
    hasOpenFiles: s.openFiles.length > 0,
    mainView: s.mainView,
    splitDirection: s.splitDirection,
    splitFilePath: s.splitFilePath,
  })));

  const handleTreeResize = useProjectTreeResize();
  const handleAgentResize = useAgentPanelResize();

  const treeCols = projectTreeOpen
    ? `${projectTreeWidth}px 4px `
    : '';

  const gridColumns = `${ICON_RAIL_WIDTH}px ${treeCols}1fr`;

  const renderMainContent = () => {
    // File tabs take priority when mainView is 'files'
    if (mainView === 'files' && hasOpenFiles) {
      const hasSplit = splitDirection !== 'none' && splitFilePath;
      return (
        <>
          <FileTabBar />
          <div className={`workspace-content workspace-content--flush workspace-split--${hasSplit ? splitDirection : 'none'}`} style={{ flex: 1, minWidth: 0 }}>
            <FileEditor />
            {hasSplit && <SplitFileEditor filePath={splitFilePath} />}
          </div>
        </>
      );
    }

    // Page view
    switch (activePage) {
      case 'overview': return <div className="workspace-content workspace-content--flush"><OverviewPage /></div>;
      case 'outline': return <div className="workspace-content workspace-content--flush"><OutlineEditor /></div>;
      case 'novel':
      case 'script': return <div className="workspace-content workspace-content--flush"><ScriptEditorPage /></div>;
      case 'storyboard': return <div className="workspace-panel-content"><StoryboardCanvas /></div>;
      case 'image_gen': return <div className="workspace-panel-content"><ImageGenEditor /></div>;
      case 'video': return <div className="workspace-panel-content"><VideoEditor /></div>;
      case 'assets': return <div className="workspace-panel-content"><AssetsPanel /></div>;
      default: return <div className="workspace-panel-content"><OverviewPage /></div>;
    }
  };

  return (
    <div className="workspace-shell">
      <div className="workspace-body" style={{ gridTemplateColumns: gridColumns }}>
        <SideNav />
        {projectTreeOpen && (
          <>
            <Suspense fallback={null}>
              {activeSidebarPanel === 'timeline' ? <TimelinePanel /> : activeSidebarPanel === 'search' ? <SearchPanel /> : <ProjectTree />}
            </Suspense>
            <ResizeHandle onResize={handleTreeResize} />
          </>
        )}
        <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
          <div className="workspace-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, position: 'relative' }}>
            <Suspense fallback={null}>
              {renderMainContent()}
            </Suspense>
          </div>
          <Tooltip label="Agent" placement="left">
            <button
              type="button"
              className={`agent-side-tab${agentPanelOpen ? ' is-open' : ''}`}
              onClick={toggleAgentPanel}
              aria-label="Agent"
            >
              <span className="material-symbols-outlined">
                {agentPanelOpen ? 'chevron_right' : 'chevron_left'}
              </span>
            </button>
          </Tooltip>
          {agentPanelOpen && (
            <>
              <ResizeHandle onResize={handleAgentResize} />
              <div style={{ width: agentPanelWidth, flexShrink: 0 }}>
                <AgentPanel />
              </div>
            </>
          )}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
