import { useAppStore } from '../../shared/store/appStore';
import type { NovelChapterRunMode } from '../../shared/store/novelChapterSlice';

const ACTIONS: Array<{ mode: NovelChapterRunMode; label: string }> = [
  { mode: 'generate', label: '生成本章' },
  { mode: 'continue', label: '续写' },
  { mode: 'polish', label: '润色' },
  { mode: 'review', label: '复审' },
];

export function ChapterActionsBar() {
  const activeId = useAppStore((state) => state.activeChapterId);
  const startRun = useAppStore((state) => state.startChapterRun);
  const status = useAppStore((state) => state.chapterCandidateStatus);

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
      {ACTIONS.map((action) => (
        <button
          key={action.mode}
          type="button"
          disabled={isRunning}
          onClick={() => void startRun(activeId, action.mode)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
