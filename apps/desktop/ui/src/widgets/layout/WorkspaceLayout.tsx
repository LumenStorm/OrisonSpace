import { EditorTabs } from '../../features/editor/EditorTabs';
import { InspectorPanel } from '../../features/inspector/InspectorPanel';
import { ProjectTree } from '../../features/project-tree/ProjectTree';
import { TaskFeedPanel } from '../../features/tasks/TaskFeedPanel';
import { TopBar } from '../../features/top-bar/TopBar';

export function WorkspaceLayout() {
  return (
    <div className="workspace-shell">
      <TopBar />
      <div className="workspace-body">
        <ProjectTree />
        <main className="workspace-main">
          <EditorTabs />
        </main>
        <div style={{ minWidth: 0 }}>
          <InspectorPanel />
          <TaskFeedPanel />
        </div>
      </div>
    </div>
  );
}
