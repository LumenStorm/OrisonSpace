import { AutoModeConsole } from '../auto-mode/AutoModeConsole';
import { ChapterActionsBar } from './ChapterActionsBar';
import { ChapterListPanel } from './ChapterListPanel';
import { ChapterResultPanel } from './ChapterResultPanel';

export function NovelWorkbench() {
  return (
    <div className="novel-workbench" aria-label="Novel Workbench">
      <aside className="novel-workbench-sidebar">
        <header className="novel-workbench-sidebar-header">
          <strong>绔犺妭</strong>
        </header>
        <ChapterListPanel />
        <AutoModeConsole />
      </aside>

      <main className="novel-workbench-main">
        <ChapterActionsBar />
        <ChapterResultPanel />
      </main>
    </div>
  );
}
