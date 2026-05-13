import { useShallow } from 'zustand/react/shallow';
import { EditorArea } from '../../features/editor/EditorArea';
import { SideNav } from '../../features/side-nav/SideNav';
import { ProjectTree } from '../../features/project-tree/ProjectTree';
import { BottomPanel } from '../../features/bottom-panel/BottomPanel';
import { AgentPanel } from '../../features/agent-panel/AgentPanel';
import { ResizeHandle } from '../../shared/components/ResizeHandle';
import { useAppStore } from '../../shared/store/appStore';
import { useBottomPanelResize, useProjectTreeResize, useAgentPanelResize } from '../../shared/hooks/usePanelResize';
import { ICON_RAIL_WIDTH } from '../../shared/constants';

export function WorkspaceLayout() {
  const {
    projectTreeOpen, projectTreeWidth,
    bottomPanelOpen, bottomPanelHeight,
    toggleBottomPanel,
    agentPanelOpen, agentPanelWidth,
  } = useAppStore(useShallow((s) => ({
    projectTreeOpen: s.projectTreeOpen,
    projectTreeWidth: s.projectTreeWidth,
    bottomPanelOpen: s.bottomPanelOpen,
    bottomPanelHeight: s.bottomPanelHeight,
    toggleBottomPanel: s.toggleBottomPanel,
    agentPanelOpen: s.agentPanelOpen,
    agentPanelWidth: s.agentPanelWidth,
  })));

  const handleTreeResize = useProjectTreeResize();
  const handleBottomResize = useBottomPanelResize();
  const handleAgentResize = useAgentPanelResize();

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
            <ProjectTree />
            <ResizeHandle onResize={handleTreeResize} />
          </>
        )}
        <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
          <div className="workspace-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
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
