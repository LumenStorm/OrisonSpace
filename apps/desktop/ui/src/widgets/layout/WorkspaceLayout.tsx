import { useShallow } from 'zustand/react/shallow';
import { EditorArea } from '../../features/editor/EditorArea';
import { SideNav } from '../../features/side-nav/SideNav';
import { ProjectTree } from '../../features/project-tree/ProjectTree';
import { BottomPanel } from '../../features/bottom-panel/BottomPanel';
import { ContextRail } from '../../features/context-rail/ContextRail';
import { ObjectListPane } from '../../features/object-list/ObjectListPane';
import { SystemRail } from '../../features/system-rail/SystemRail';
import { ResizeHandle } from '../../shared/components/ResizeHandle';
import { useAppStore } from '../../shared/store/appStore';
import { useBottomPanelResize, useProjectTreeResize } from '../../shared/hooks/usePanelResize';
import { ICON_RAIL_WIDTH } from '../../shared/constants';

export function WorkspaceLayout() {
  const {
    projectTreeOpen, projectTreeWidth,
    bottomPanelOpen, bottomPanelHeight,
    toggleBottomPanel,
    currentProject,
  } = useAppStore(useShallow((s) => ({
    projectTreeOpen: s.projectTreeOpen,
    projectTreeWidth: s.projectTreeWidth,
    bottomPanelOpen: s.bottomPanelOpen,
    bottomPanelHeight: s.bottomPanelHeight,
    toggleBottomPanel: s.toggleBottomPanel,
    currentProject: s.currentProject,
  })));

  const handleTreeResize = useProjectTreeResize();
  const handleBottomResize = useBottomPanelResize();

  const treeCols = projectTreeOpen
    ? `${projectTreeWidth}px 4px `
    : '';

  const gridColumns = `${ICON_RAIL_WIDTH}px ${treeCols}1fr`;
  const isNovelProject = currentProject?.type === 'novel';

  return (
    <div className="workspace-shell">
      <div
        className={`workspace-body${isNovelProject ? ' workspace-body-novel' : ''}`}
        style={isNovelProject ? undefined : { gridTemplateColumns: gridColumns }}
      >
        <SideNav />
        {isNovelProject ? (
          <>
            <ObjectListPane />
            <div className="workspace-main">
              <div className="workspace-content">
                <EditorArea />
              </div>
              <SystemRail />
            </div>
            <ContextRail />
          </>
        ) : (
          <>
            {projectTreeOpen && (
              <>
                <ProjectTree />
                <ResizeHandle onResize={handleTreeResize} />
              </>
            )}
            <div className="workspace-main">
              <div className="workspace-content">
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
          </>
        )}
      </div>
      {!isNovelProject && !bottomPanelOpen && (
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
