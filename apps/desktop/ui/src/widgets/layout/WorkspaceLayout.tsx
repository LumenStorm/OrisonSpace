import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EditorArea } from '../../features/editor/EditorArea';
import { SideNav } from '../../features/side-nav/SideNav';
import { ProjectTree } from '../../features/project-tree/ProjectTree';
import { BottomPanel } from '../../features/bottom-panel/BottomPanel';
import { ResizeHandle } from '../../shared/components/ResizeHandle';
import { useAppStore } from '../../shared/store/appStore';
import { ICON_RAIL_WIDTH } from '../../shared/constants';

export function WorkspaceLayout() {
  const {
    projectTreeOpen, projectTreeWidth, setProjectTreeWidth,
    bottomPanelOpen, bottomPanelHeight, setBottomPanelHeight,
    toggleBottomPanel,
  } = useAppStore(useShallow((s) => ({
    projectTreeOpen: s.projectTreeOpen,
    projectTreeWidth: s.projectTreeWidth,
    setProjectTreeWidth: s.setProjectTreeWidth,
    bottomPanelOpen: s.bottomPanelOpen,
    bottomPanelHeight: s.bottomPanelHeight,
    setBottomPanelHeight: s.setBottomPanelHeight,
    toggleBottomPanel: s.toggleBottomPanel,
  })));

  const handleTreeResize = useCallback(
    (delta: number) => {
      const w = useAppStore.getState().projectTreeWidth;
      setProjectTreeWidth(w + delta);
    },
    [setProjectTreeWidth],
  );

  const handleBottomResize = useCallback(
    (delta: number) => {
      const h = useAppStore.getState().bottomPanelHeight;
      setBottomPanelHeight(h - delta);
    },
    [setBottomPanelHeight],
  );

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
