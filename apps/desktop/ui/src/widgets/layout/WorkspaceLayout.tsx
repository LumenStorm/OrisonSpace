import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EditorArea } from '../../features/editor/EditorArea';
import { InspectorPanel } from '../../features/inspector/InspectorPanel';
import { SideNav } from '../../features/side-nav/SideNav';
import { ProjectTree } from '../../features/project-tree/ProjectTree';
import { TaskFeedPanel } from '../../features/tasks/TaskFeedPanel';
import { ResizeHandle } from '../../shared/components/ResizeHandle';
import { useAppStore } from '../../shared/store/appStore';
import { ICON_RAIL_WIDTH, BREAKPOINT_COLLAPSE_INSPECTOR } from '../../shared/constants';

export function WorkspaceLayout() {
  const {
    projectTreeOpen, projectTreeWidth, setProjectTreeWidth,
    inspectorWidth, setInspectorWidth,
    inspectorOpen, toggleInspector,
  } = useAppStore(useShallow((s) => ({
    projectTreeOpen: s.projectTreeOpen,
    projectTreeWidth: s.projectTreeWidth,
    setProjectTreeWidth: s.setProjectTreeWidth,
    inspectorWidth: s.inspectorWidth,
    setInspectorWidth: s.setInspectorWidth,
    inspectorOpen: s.inspectorOpen,
    toggleInspector: s.toggleInspector,
  })));

  const handleTreeResize = useCallback(
    (delta: number) => {
      const w = useAppStore.getState().projectTreeWidth;
      setProjectTreeWidth(w + delta);
    },
    [setProjectTreeWidth],
  );

  const handleInspectorResize = useCallback(
    (delta: number) => {
      const w = useAppStore.getState().inspectorWidth;
      setInspectorWidth(w - delta);
    },
    [setInspectorWidth],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (window.innerWidth < BREAKPOINT_COLLAPSE_INSPECTOR && inspectorOpen) {
          toggleInspector();
        }
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
    };
  }, [inspectorOpen, toggleInspector]);

  const treeCols = projectTreeOpen
    ? `${projectTreeWidth}px 4px `
    : '';

  const inspectorCols = inspectorOpen
    ? ` 4px ${inspectorWidth}px`
    : '';

  const gridColumns = `${ICON_RAIL_WIDTH}px ${treeCols}1fr${inspectorCols}`;

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
        <main className="workspace-main">
          <EditorArea />
        </main>
        {inspectorOpen && (
          <>
            <ResizeHandle onResize={handleInspectorResize} />
            <div className="workspace-right">
              <InspectorPanel />
              <TaskFeedPanel />
            </div>
          </>
        )}
      </div>
      {!inspectorOpen && (
        <button
          type="button"
          className="inspector-expand-btn"
          aria-label="Open Inspector"
          onClick={toggleInspector}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      )}
    </div>
  );
}
