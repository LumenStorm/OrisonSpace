import { useAppStore } from '../../shared/store/appStore';
import { ChapterListPanel } from './ChapterListPanel';
import { ChapterResultPanel } from './ChapterResultPanel';
import { AutoModeConsole } from '../auto-mode/AutoModeConsole';
import type { NovelChapterRunMode } from '../../shared/store/novelChapterSlice';

const ACTIONS: Array<{ mode: NovelChapterRunMode; label: string }> = [
  { mode: 'generate', label: '生成本章' },
  { mode: 'continue', label: '续写' },
  { mode: 'polish', label: '润色' },
  { mode: 'review', label: '复审' },
];

function ChapterActionsBar() {
  const activeId = useAppStore((s) => s.activeChapterId);
  const startRun = useAppStore((s) => s.startChapterRun);
  const status = useAppStore((s) => s.chapterCandidateStatus);

  if (!activeId) {
    return (
      <div className="novel-chapter-actions-bar novel-chapter-actions-empty">
        <p>请选择一个章节以触发生成。</p>
      </div>
    );
  }

  const isRunning = status === 'running';

  return (
    <div className="novel-chapter-actions-bar" aria-label="Chapter Actions">
      {ACTIONS.map((act) => (
        <button
          key={act.mode}
          type="button"
          disabled={isRunning}
          onClick={() => void startRun(activeId, act.mode)}
        >
          {act.label}
        </button>
      ))}
    </div>
  );
}

export function NovelWorkbench() {
  return (
    <div className="novel-workbench" aria-label="Novel Workbench">
      <aside className="novel-workbench-sidebar">
        <header className="novel-workbench-sidebar-header">
          <strong>章节</strong>
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
