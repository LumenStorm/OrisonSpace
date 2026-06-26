import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { ChapterActionsBar } from './ChapterActionsBar';
import { ChapterListPanel } from './ChapterListPanel';
import { ChapterResultPanel } from './ChapterResultPanel';

export function NovelWorkbench() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="novel-workbench" aria-label="Novel Workbench">
      <aside className="novel-workbench-sidebar">
        <header className="novel-workbench-sidebar-header">
          <strong>{t('script.chapters')}</strong>
        </header>
        <ChapterListPanel />
        {/* AutoModeConsole removed: the auto-mode execution engine was deleted
            with the Python agent chain (commit 820a969) and never replaced, so
            the console was a non-functional shell. Hidden until the engine is
            rebuilt — see docs/internal/auto-mode-rebuild-plan.md. */}
      </aside>

      <main className="novel-workbench-main">
        <ChapterActionsBar />
        <ChapterResultPanel />
      </main>
    </div>
  );
}
