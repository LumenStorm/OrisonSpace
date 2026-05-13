import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { AgentMessages } from './AgentMessages';
import { AgentInput } from './AgentInput';
import { AgentHistory } from './AgentHistory';
import { useState } from 'react';

export function AgentPanel() {
  const {
    agentMessages, agentLoading, agentError,
    newAgentSession, loadAgentSessions, resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    agentMessages: s.agentMessages,
    agentLoading: s.agentLoading,
    agentError: s.agentError,
    newAgentSession: s.newAgentSession,
    loadAgentSessions: s.loadAgentSessions,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);
  const [showHistory, setShowHistory] = useState(false);

  const handleShowHistory = () => {
    loadAgentSessions();
    setShowHistory(true);
  };

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <span className="agent-panel-title">{t('agent.title')}</span>
        <div className="agent-panel-header-actions">
          <button
            type="button"
            className="agent-panel-icon-btn"
            onClick={() => newAgentSession()}
            title={t('agent.newConversation')}
          >
            <span className="material-symbols-outlined">add</span>
          </button>
          <button
            type="button"
            className="agent-panel-icon-btn"
            onClick={handleShowHistory}
            title={t('agent.history')}
          >
            <span className="material-symbols-outlined">history</span>
          </button>
        </div>
      </div>

      {showHistory ? (
        <AgentHistory onClose={() => setShowHistory(false)} />
      ) : (
        <>
          <AgentMessages messages={agentMessages} loading={agentLoading} error={agentError} />
          <AgentInput />
        </>
      )}
    </div>
  );
}
