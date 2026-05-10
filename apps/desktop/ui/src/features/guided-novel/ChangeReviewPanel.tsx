import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function ChangeReviewPanel() {
  const checklist = useAppStore((s) => s.guidedNovelState?.changeChecklist);
  const acceptGuidedChanges = useAppStore((s) => s.acceptGuidedChanges);
  const guidedNovelLoading = useAppStore((s) => s.guidedNovelLoading);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const hasChanges = (checklist?.items ?? []).length > 0;

  return (
    <section className="guided-novel-panel" aria-label={t('guidedNovel.changeReviewTitle')}>
      <div className="guided-novel-header">
        <span className="guided-novel-kicker">{t('guidedNovel.reviewKicker')}</span>
        <h2>{t('guidedNovel.changeReviewTitle')}</h2>
        <p>{t('guidedNovel.changeReviewDescription')}</p>
      </div>
      <div className="guided-novel-list">
        {!hasChanges ? (
          <p>{t('guidedNovel.noPendingChanges')}</p>
        ) : (
          checklist!.items.map((item) => (
            <article key={item.id} className="guided-novel-list-item">
              <strong>{item.type}</strong>
              <span>{String(item.payload.name ?? item.payload.id ?? item.id)}</span>
            </article>
          ))
        )}
      </div>
      <div className="guided-novel-actions">
        <button
          type="button"
          className="guided-novel-primary"
          disabled={!hasChanges || guidedNovelLoading}
          onClick={() => void acceptGuidedChanges()}
        >
          {t('guidedNovel.acceptChanges')}
        </button>
      </div>
    </section>
  );
}
