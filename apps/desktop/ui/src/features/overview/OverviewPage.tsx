import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';

export function OverviewPage() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const project = useAppStore((s) => s.currentProject);
  const chapters = useAppStore((s) => s.novelChapters) as NovelChapterMeta[];

  const totalChapters = chapters.length;
  const totalWords = chapters.reduce(
    (sum, ch) => sum + ch.sections.reduce((s2, sec) => s2 + (sec.wordCount ?? 0), 0),
    0,
  );
  const draftCount = chapters.filter((c) => c.status === 'draft').length;
  const finalCount = chapters.filter((c) => c.status === 'final').length;

  return (
    <div className="overview-page">
      <header className="overview-header">
        <h1 className="overview-title">{project?.name ?? t('overview.untitled')}</h1>
        {project?.type && <span className="overview-type-badge">{project.type}</span>}
      </header>

      <section className="overview-cards">
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">menu_book</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{totalChapters}</span>
            <span className="overview-card-label">{t('overview.chapters')}</span>
          </div>
        </div>
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">text_fields</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{totalWords.toLocaleString()}</span>
            <span className="overview-card-label">{t('overview.words')}</span>
          </div>
        </div>
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">edit_note</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{draftCount}</span>
            <span className="overview-card-label">{t('overview.drafts')}</span>
          </div>
        </div>
        <div className="overview-card">
          <span className="overview-card-icon material-symbols-outlined">check_circle</span>
          <div className="overview-card-body">
            <span className="overview-card-value">{finalCount}</span>
            <span className="overview-card-label">{t('overview.final')}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
