import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { RunSnapshot } from './types';

export function DeliveryView({ run }: { run: RunSnapshot }) {
  const { resolvedLocale } = useAppStore(useShallow((s) => ({ resolvedLocale: s.resolvedLocale })));
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="orchestration-delivery" aria-label={t('orchestration.deliveryLabel')}>
      <p>{t('orchestration.delivered', { summary: run.delivery?.summary ?? '' })}</p>
      {run.archive ? <p>{t('orchestration.archiveVersion', { versionId: run.archive.versionId })}</p> : null}
      {run.feedback?.memo ? <p>{t('orchestration.feedbackMemo', { memo: run.feedback.memo })}</p> : null}
    </div>
  );
}
