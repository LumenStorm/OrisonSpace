import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function ImpactReviewPanel() {
  const review = useAppStore((s) => s.guidedNovelState?.impactReview);
  const chooseGuidedImpactAction = useAppStore((s) => s.chooseGuidedImpactAction);
  const guidedNovelLoading = useAppStore((s) => s.guidedNovelLoading);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <section className="guided-novel-panel" aria-label={t('guidedNovel.impactTitle')}>
      <div className="guided-novel-header">
        <span className="guided-novel-kicker">{t('guidedNovel.impactKicker')}</span>
        <h2>{t('guidedNovel.impactTitle')}</h2>
        <p>{review?.summary ?? t('guidedNovel.impactDescription')}</p>
      </div>
      <div className="guided-novel-actions">
        <button
          type="button"
          className="guided-novel-primary"
          disabled={guidedNovelLoading}
          onClick={() => chooseGuidedImpactAction('continue')}
        >
          {t('guidedNovel.continueAction')}
        </button>
        <button
          type="button"
          className="guided-novel-secondary"
          disabled={guidedNovelLoading}
          onClick={() => chooseGuidedImpactAction('replan')}
        >
          {t('guidedNovel.replanAction')}
        </button>
      </div>
    </section>
  );
}
