import { EditorArea } from '../../features/editor/EditorArea';
import { InspectorPanel } from '../../features/inspector/InspectorPanel';
import { SideNav } from '../../features/side-nav/SideNav';
import { TaskFeedPanel } from '../../features/tasks/TaskFeedPanel';

export function WorkspaceLayout() {
  return (
    <div className="workspace-shell">
      <div className="workspace-body">
        <SideNav />
        <main className="workspace-main">
          <EditorArea />
        </main>
        <div className="workspace-right">
          <InspectorPanel />
          <TaskFeedPanel />
        </div>
      </div>
    </div>
  );
}
