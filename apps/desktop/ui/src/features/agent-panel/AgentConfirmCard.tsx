import { useAppStore } from '../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../../shared/i18n/useI18n';

export function AgentConfirmCard() {
  const { pending, confirm, reject, resolvedLocale } = useAppStore(useShallow((s) => ({
    pending: s.pendingToolConfirm,
    confirm: s.confirmPendingTool,
    reject: s.rejectPendingTool,
    resolvedLocale: s.resolvedLocale,
  })));
  const { t } = useI18n(resolvedLocale);

  if (!pending) return null;

  return (
    <div className="agent-confirm-card">
      <div className="agent-confirm-card-header">
        <span className="material-symbols-outlined">warning</span>
        <span>{t('agent.confirm')}: <strong>{pending.name}</strong></span>
      </div>
      <pre className="agent-confirm-card-input">
        {JSON.stringify(pending.input, null, 2)}
      </pre>
      <div className="agent-confirm-card-actions">
        <button type="button" className="agent-confirm-btn agent-confirm-btn-accept" onClick={confirm}>
          {t('agent.accept')}
        </button>
        <button type="button" className="agent-confirm-btn agent-confirm-btn-reject" onClick={reject}>
          {t('agent.reject')}
        </button>
      </div>
    </div>
  );
}
