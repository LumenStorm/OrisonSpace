import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { AutoModeConsole } from '../auto-mode/AutoModeConsole';
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
        <AutoModeConsole />
      </aside>

      <main className="novel-workbench-main">
        <ChapterActionsBar />
        <ChapterResultPanel />
      </main>
    </div>
  );
}
