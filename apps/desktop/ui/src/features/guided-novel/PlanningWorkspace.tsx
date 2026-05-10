import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function PlanningWorkspace() {
  const state = useAppStore((s) => s.guidedNovelState);
  const confirmGuidedBaseline = useAppStore((s) => s.confirmGuidedBaseline);
  const guidedNovelLoading = useAppStore((s) => s.guidedNovelLoading);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const isReadyToWrite = state?.session?.status === 'ready_to_write';

  return (
    <section className="guided-novel-panel" aria-label={t('guidedNovel.planningTitle')}>
      <div className="guided-novel-header">
        <span className="guided-novel-kicker">{t('guidedNovel.planningKicker')}</span>
        <h2>{t('guidedNovel.planningTitle')}</h2>
        <p>{t('guidedNovel.planningDescription')}</p>
      </div>
      <div className="guided-novel-card-grid">
        <article className="guided-novel-card">
          <h3>{t('guidedNovel.planningBriefTitle')}</h3>
          <p>{state?.planningBaseline?.fields.creative_brief?.rawRequirement ?? t('guidedNovel.noBrief')}</p>
        </article>
        <article className="guided-novel-card">
          <h3>{t('guidedNovel.planningWorldTitle')}</h3>
          <p>{state?.planningBaseline?.fields.world_setting?.premise ?? t('guidedNovel.noWorldPremise')}</p>
        </article>
      </div>
      <div className="guided-novel-actions">
        <button
          type="button"
          className="guided-novel-primary"
          disabled={guidedNovelLoading}
          onClick={() => void confirmGuidedBaseline()}
        >
          {isReadyToWrite ? t('guidedNovel.continueWriting') : t('guidedNovel.confirm')}
        </button>
      </div>
    </section>
  );
}
