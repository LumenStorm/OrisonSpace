import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { ChapterTaskCardPanel } from './ChapterTaskCardPanel';

export function ChapterReviewPanel() {
  const approveGuidedChapter = useAppStore((s) => s.approveGuidedChapter);
  const guidedNovelLoading = useAppStore((s) => s.guidedNovelLoading);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <section className="guided-novel-panel" aria-label={t('guidedNovel.chapterReviewTitle')}>
      <div className="guided-novel-header">
        <span className="guided-novel-kicker">{t('guidedNovel.reviewKicker')}</span>
        <h2>{t('guidedNovel.chapterReviewTitle')}</h2>
        <p>{t('guidedNovel.chapterReviewDescription')}</p>
      </div>
      <ChapterTaskCardPanel />
      <div className="guided-novel-actions">
        <button
          type="button"
          className="guided-novel-primary"
          disabled={guidedNovelLoading}
          onClick={() => void approveGuidedChapter()}
        >
          {t('guidedNovel.approveChapter')}
        </button>
        <button type="button" className="guided-novel-secondary" disabled>
          {t('guidedNovel.requestRevision')}
        </button>
      </div>
    </section>
  );
}
