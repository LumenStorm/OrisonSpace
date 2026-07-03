import { lazy, Suspense, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SideNav } from '../../features/side-nav/SideNav';
import { AgentPanel } from '../../features/agent-panel/AgentPanel';
import { BottomPanel } from '../../features/bottom-panel/BottomPanel';
import { ResizeHandle } from '../../shared/components/ResizeHandle';
import { PageSkeleton } from '../../shared/components/PageSkeleton';
import { ErrorBoundary } from '../../shared/components/ErrorBoundary';
import { Tooltip } from '../../shared/components/Tooltip';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useProjectTreeResize, useAgentPanelResize } from '../../shared/hooks/usePanelResize';
import { useAutoSave } from '../../shared/hooks/useAutoSave';
import { ICON_RAIL_WIDTH } from '../../shared/constants';
import { StatusBar } from '../../features/status-bar/StatusBar';

const ProjectTree = lazy(() => import('../../features/project-tree/ProjectTree').then((m) => ({ default: m.ProjectTree })));
const SearchPanel = lazy(() => import('../../features/search-panel/SearchPanel').then((m) => ({ default: m.SearchPanel })));
const TimelinePanel = lazy(() => import('../../features/timeline/TimelinePanel').then((m) => ({ default: m.TimelinePanel })));
const OverviewPage = lazy(() => import('../../features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const OutlineEditor = lazy(() => import('../../features/editor/OutlineEditor').then((m) => ({ default: m.OutlineEditor })));
const ImageGenEditor = lazy(() => import('../../features/editor/ImageGenEditor').then((m) => ({ default: m.ImageGenEditor })));
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
    activeFilePath, setSplit,
    bottomPanelOpen,
    resolvedLocale,
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
    activeFilePath: s.activeFilePath,
    setSplit: s.setSplit,
    bottomPanelOpen: s.bottomPanelOpen,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);
  const handleTreeResize = useProjectTreeResize();
  const handleAgentResize = useAgentPanelResize();
  useAutoSave();

  // Same-file dual panes overwrite each other (independent editor instances,
  // no shared doc model) — when any tab activation lands the split's file in
  // the main pane, collapse the split so the document is only mounted once.
  // setSplit already prevents this at creation; this catches every later
  // activation path (tab click, cycle, close-fallback, reopen).
  const splitCollides = (splitDirection === 'horizontal' || splitDirection === 'vertical')
    && splitFilePath !== null && splitFilePath === activeFilePath;
  useEffect(() => {
    if (splitCollides) setSplit('none');
  }, [splitCollides, setSplit]);

  const treeCols = projectTreeOpen
    ? `${projectTreeWidth}px 4px `
    : '';

  const gridColumns = `${ICON_RAIL_WIDTH}px ${treeCols}1fr`;

  const renderMainContent = () => {
    // File tabs take priority when mainView is 'files'
    if (mainView === 'files' && hasOpenFiles) {
      const hasSplit = splitDirection !== 'none' && splitFilePath && !splitCollides;
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
      // 'novel'/'script' are legacy page routes; the manuscript is now edited as
      // .md file tabs (opened from the overview / project tree). Fall through to
      // the overview so a stale persisted activePage can't render a dead editor.
      case 'novel':
      case 'script':
        return <div className="workspace-content workspace-content--flush"><OverviewPage /></div>;
      case 'image_gen': return <div className="workspace-panel-content"><ImageGenEditor /></div>;
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
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton variant="sidebar" />}>
                {activeSidebarPanel === 'timeline' ? <TimelinePanel /> : activeSidebarPanel === 'search' ? <SearchPanel /> : <ProjectTree />}
              </Suspense>
            </ErrorBoundary>
            <ResizeHandle onResize={handleTreeResize} />
          </>
        )}
        <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
          <div id="main-content" tabIndex={-1} className="workspace-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, position: 'relative' }}>
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton variant="page" />}>
                {renderMainContent()}
              </Suspense>
            </ErrorBoundary>
            {bottomPanelOpen && <BottomPanel />}
          </div>
          <Tooltip label={t('workspace.agentPanel')} placement="left">
            <button
              type="button"
              className={`agent-side-tab${agentPanelOpen ? ' is-open' : ''}`}
              onClick={toggleAgentPanel}
              aria-label={t('workspace.agentPanel')}
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
