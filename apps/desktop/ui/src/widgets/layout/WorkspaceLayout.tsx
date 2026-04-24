import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EditorArea } from '../../features/editor/EditorArea';
import { InspectorPanel } from '../../features/inspector/InspectorPanel';
import { SideNav } from '../../features/side-nav/SideNav';
import { TaskFeedPanel } from '../../features/tasks/TaskFeedPanel';
import { ResizeHandle } from '../../shared/components/ResizeHandle';
import { useAppStore } from '../../shared/store/appStore';
import { BREAKPOINT_COLLAPSE_INSPECTOR } from '../../shared/constants';

export function WorkspaceLayout() {
  const {
    sidebarWidth, setSidebarWidth,
    inspectorWidth, setInspectorWidth,
    inspectorOpen, toggleInspector,
  } = useAppStore(useShallow((s) => ({
    sidebarWidth: s.sidebarWidth,
    setSidebarWidth: s.setSidebarWidth,
    inspectorWidth: s.inspectorWidth,
    setInspectorWidth: s.setInspectorWidth,
    inspectorOpen: s.inspectorOpen,
    toggleInspector: s.toggleInspector,
  })));

  const handleSidebarResize = useCallback(
    (delta: number) => {
      const w = useAppStore.getState().sidebarWidth;
      setSidebarWidth(w + delta);
    },
    [setSidebarWidth],
  );

  const handleInspectorResize = useCallback(
    (delta: number) => {
      const w = useAppStore.getState().inspectorWidth;
      setInspectorWidth(w - delta);
    },
    [setInspectorWidth],
  );

  // Responsive: auto-collapse inspector on narrow windows
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

  const gridColumns = inspectorOpen
    ? `${sidebarWidth}px 4px 1fr 4px ${inspectorWidth}px`
    : `${sidebarWidth}px 4px 1fr`;

  return (
    <div className="workspace-shell">
      <div className="workspace-body" style={{ gridTemplateColumns: gridColumns }}>
        <SideNav />
        <ResizeHandle onResize={handleSidebarResize} />
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
