import { useShallow } from 'zustand/react/shallow';
import { SideNav } from '../../features/side-nav/SideNav';
import { ProjectTree } from '../../features/project-tree/ProjectTree';
import { SearchPanel } from '../../features/search-panel/SearchPanel';
import { BottomPanel } from '../../features/bottom-panel/BottomPanel';
import { AgentPanel } from '../../features/agent-panel/AgentPanel';
import { ResizeHandle } from '../../shared/components/ResizeHandle';
import { useAppStore } from '../../shared/store/appStore';
import { useBottomPanelResize, useProjectTreeResize, useAgentPanelResize } from '../../shared/hooks/usePanelResize';
import { ICON_RAIL_WIDTH } from '../../shared/constants';
import { OverviewPage } from '../../features/overview/OverviewPage';
import { OutlineEditor } from '../../features/editor/OutlineEditor';
import { FileTabBar } from '../../features/editor/FileTabBar';
import { FileEditor } from '../../features/editor/FileEditor';
import { ImageGenEditor } from '../../features/editor/ImageGenEditor';
import { StoryboardCanvas } from '../../features/editor/StoryboardCanvas';
import { VideoEditor } from '../../features/editor/VideoEditor';
import { AssetsPanel } from '../../features/assets/AssetsPanel';
import { ScriptEditorPage } from '../../features/editor/ScriptEditorPage';
import { TimelinePanel } from '../../features/timeline/TimelinePanel';

export function WorkspaceLayout() {
  const {
    activePage,
    projectTreeOpen, projectTreeWidth,
    activeSidebarPanel,
    bottomPanelOpen, bottomPanelHeight,
    toggleBottomPanel,
    agentPanelOpen, agentPanelWidth,
    hasOpenFiles,
  } = useAppStore(useShallow((s) => ({
    activePage: s.activePage,
    projectTreeOpen: s.projectTreeOpen,
    projectTreeWidth: s.projectTreeWidth,
    activeSidebarPanel: s.activeSidebarPanel,
    bottomPanelOpen: s.bottomPanelOpen,
    bottomPanelHeight: s.bottomPanelHeight,
    toggleBottomPanel: s.toggleBottomPanel,
    agentPanelOpen: s.agentPanelOpen,
    agentPanelWidth: s.agentPanelWidth,
    hasOpenFiles: s.openFiles.length > 0,
  })));

  const handleTreeResize = useProjectTreeResize();
  const handleBottomResize = useBottomPanelResize();
  const handleAgentResize = useAgentPanelResize();

  const treeCols = projectTreeOpen
    ? `${projectTreeWidth}px 4px `
    : '';

  const gridColumns = `${ICON_RAIL_WIDTH}px ${treeCols}1fr`;

  const renderMainContent = () => {
    // File tabs take priority over page view
    if (hasOpenFiles) {
      return (
        <>
          <FileTabBar />
          <div className="workspace-content" style={{ flex: 1, minWidth: 0 }}>
            <FileEditor />
          </div>
        </>
      );
    }

    // Page view
    switch (activePage) {
      case 'overview': return <div className="workspace-panel-content"><OverviewPage /></div>;
      case 'outline': return <div className="workspace-content"><OutlineEditor /></div>;
      case 'novel':
      case 'script': return <div className="workspace-content"><ScriptEditorPage /></div>;
      case 'storyboard': return <div className="workspace-panel-content"><StoryboardCanvas /></div>;
      case 'image_gen': return <div className="workspace-panel-content"><ImageGenEditor /></div>;
      case 'video': return <div className="workspace-panel-content"><VideoEditor /></div>;
      case 'assets': return <div className="workspace-panel-content"><AssetsPanel /></div>;
      case 'timeline': return <div className="workspace-panel-content"><TimelinePanel /></div>;
      default: return <div className="workspace-panel-content"><OverviewPage /></div>;
    }
  };

  return (
    <div className="workspace-shell">
      <div className="workspace-body" style={{ gridTemplateColumns: gridColumns }}>
        <SideNav />
        {projectTreeOpen && (
          <>
            {activeSidebarPanel === 'search' ? <SearchPanel /> : <ProjectTree />}
            <ResizeHandle onResize={handleTreeResize} />
          </>
        )}
        <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
          <div className="workspace-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            {renderMainContent()}
            <ResizeHandle direction="vertical" onResize={handleBottomResize} style={{ display: bottomPanelOpen ? undefined : 'none' }} />
            <div
              className={`workspace-bottom-wrapper${bottomPanelOpen ? ' is-open' : ''}`}
              style={{ height: bottomPanelOpen ? bottomPanelHeight : 0 }}
            >
              <BottomPanel />
            </div>
          </div>
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
      {!bottomPanelOpen && (
        <button
          type="button"
          className="bottom-panel-expand-btn"
          aria-label="Open panel"
          onClick={toggleBottomPanel}
        >
          <span className="material-symbols-outlined">expand_less</span>
        </button>
      )}
    </div>
  );
}
