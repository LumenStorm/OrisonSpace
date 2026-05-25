import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type Props = { onClose: () => void };

export function AgentHistory({ onClose }: Props) {
  const { sessions, switchAgentSession, deleteAgentSession, resolvedLocale } = useAppStore(useShallow((s) => ({
    sessions: s.agentSessions,
    switchAgentSession: s.switchAgentSession,
    deleteAgentSession: s.deleteAgentSession,
    resolvedLocale: s.resolvedLocale,
  })));
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="agent-history">
      <div className="agent-history-header">
        <span>{t('agent.history')}</span>
        <button type="button" className="agent-panel-icon-btn" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="agent-history-list">
        {sessions.length === 0 && (
          <div className="agent-history-empty">{t('agent.noHistory')}</div>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="agent-history-item">
            <button
              type="button"
              className="agent-history-item-btn"
              onClick={() => { switchAgentSession(s.id); onClose(); }}
            >
              <span className="agent-history-item-title">{s.title || 'Untitled'}</span>
              <span className="agent-history-item-meta">
                {new Date(s.updatedAt).toLocaleDateString()} · {s.messageCount} msgs
              </span>
            </button>
            <button
              type="button"
              className="agent-history-item-delete"
              onClick={() => deleteAgentSession(s.id)}
              title={t('agent.reject')}
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
