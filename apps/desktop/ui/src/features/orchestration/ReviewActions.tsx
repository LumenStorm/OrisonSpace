import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function ReviewActions() {
  const { performAction, loading, resolvedLocale } = useAppStore(useShallow((s) => ({
    performAction: s.performOrchestrationAction,
    loading: s.orchestrationLoading,
    resolvedLocale: s.resolvedLocale,
  })));
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="orchestration-actions" aria-label="Review Actions">
      <p>{t('orchestration.needsHumanReview')}</p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void performAction({ action: 'accept_current' })}
      >
        {t('orchestration.acceptCurrent')}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => void performAction({ action: 'abort_run' })}
      >
        {t('orchestration.abortRun')}
      </button>
    </div>
  );
}
