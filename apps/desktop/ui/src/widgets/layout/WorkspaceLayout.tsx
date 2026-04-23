import { EditorArea } from '../../features/editor/EditorArea';
import { InspectorPanel } from '../../features/inspector/InspectorPanel';
import { OrchestrationPanel } from '../../features/orchestration/OrchestrationPanel';
import { SideNav } from '../../features/side-nav/SideNav';
import { TaskFeedPanel } from '../../features/tasks/TaskFeedPanel';
import { TopBar } from '../../features/top-bar/TopBar';

export function WorkspaceLayout() {
  return (
    <div className="workspace-shell">
      <TopBar />
      <div className="workspace-body">
        <SideNav />
        <main className="workspace-main">
          <EditorArea />
        </main>
        <div className="workspace-right">
          <InspectorPanel />
          <OrchestrationPanel />
          <TaskFeedPanel />
        </div>
      </div>
    </div>
  );
}
