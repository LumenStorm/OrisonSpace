import { useShallow } from 'zustand/react/shallow';
import { EditorArea } from '../../features/editor/EditorArea';
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

/** Modules that render as full-width standalone pages (no EditorArea/BottomPanel) */
const STANDALONE_MODULES = new Set(['overview', 'outline'] as const);

export function WorkspaceLayout() {
  const {
    activeModule,
    projectTreeOpen, projectTreeWidth,
    activeSidebarPanel,
    bottomPanelOpen, bottomPanelHeight,
    toggleBottomPanel,
    agentPanelOpen, agentPanelWidth,
  } = useAppStore(useShallow((s) => ({
    activeModule: s.activeModule,
    projectTreeOpen: s.projectTreeOpen,
    projectTreeWidth: s.projectTreeWidth,
    activeSidebarPanel: s.activeSidebarPanel,
    bottomPanelOpen: s.bottomPanelOpen,
    bottomPanelHeight: s.bottomPanelHeight,
    toggleBottomPanel: s.toggleBottomPanel,
    agentPanelOpen: s.agentPanelOpen,
    agentPanelWidth: s.agentPanelWidth,
  })));

  const handleTreeResize = useProjectTreeResize();
  const handleBottomResize = useBottomPanelResize();
  const handleAgentResize = useAgentPanelResize();

  const isStandalone = STANDALONE_MODULES.has(activeModule as any);

  const treeCols = projectTreeOpen
    ? `${projectTreeWidth}px 4px `
    : '';

  const gridColumns = `${ICON_RAIL_WIDTH}px ${treeCols}1fr`;

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
            {isStandalone ? (
              <div className="workspace-content">
                {activeModule === 'overview' && <OverviewPage />}
                {activeModule === 'outline' && <OutlineEditor />}
              </div>
            ) : (
              <>
                <div className="workspace-content" style={{ flex: 1, minWidth: 0 }}>
                  <EditorArea />
                </div>
                <ResizeHandle direction="vertical" onResize={handleBottomResize} style={{ display: bottomPanelOpen ? undefined : 'none' }} />
                <div
                  className={`workspace-bottom-wrapper${bottomPanelOpen ? ' is-open' : ''}`}
                  style={{ height: bottomPanelOpen ? bottomPanelHeight : 0 }}
                >
                  <BottomPanel />
                </div>
              </>
            )}
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
      {!isStandalone && !bottomPanelOpen && (
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
