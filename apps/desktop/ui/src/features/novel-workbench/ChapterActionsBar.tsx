import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { NovelChapterRunMode } from '../../shared/store/novelChapterSlice';

const ACTION_MODES: NovelChapterRunMode[] = ['generate', 'continue', 'polish', 'review'];

export function ChapterActionsBar() {
  const { activeId, startRun, status, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      activeId: s.activeChapterId,
      startRun: s.startChapterRun,
      status: s.chapterCandidateStatus,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  if (!activeId) {
    return (
      <div className="novel-chapter-actions-bar novel-chapter-actions-empty">
        <p>{t('novelChapter.selectChapter')}</p>
      </div>
    );
  }

  const isRunning = status === 'running';

  return (
    <div className="novel-chapter-actions-bar" aria-label="Chapter Actions">
      {ACTION_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          disabled={isRunning}
          onClick={() => void startRun(activeId, mode)}
        >
          {t(`novelChapter.actionLabel.${mode}`)}
        </button>
      ))}
    </div>
  );
}
