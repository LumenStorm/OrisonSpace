import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { AgentMessages } from './AgentMessages';
import { AgentInput } from './AgentInput';
import { AgentHistory } from './AgentHistory';
import { AgentSettings } from './AgentSettings';
import { useEffect, useState } from 'react';

type PanelView = 'chat' | 'history' | 'settings';

export function AgentPanel() {
  const {
    agentMessages, agentLoading, agentError,
    newAgentSession, loadAgentSessions, loadAgentSkills,
    resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    agentMessages: s.agentMessages,
    agentLoading: s.agentLoading,
    agentError: s.agentError,
    newAgentSession: s.newAgentSession,
    loadAgentSessions: s.loadAgentSessions,
    loadAgentSkills: s.loadAgentSkills,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);
  const [view, setView] = useState<PanelView>('chat');

  useEffect(() => {
    void loadAgentSkills();
  }, [loadAgentSkills]);

  const handleShowHistory = () => {
    loadAgentSessions();
    setView('history');
  };

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <span className="agent-panel-title">{t('agent.title')}</span>
        <div className="agent-panel-header-actions">
          <button
            type="button"
            className={`agent-panel-icon-btn${view === 'settings' ? ' is-active' : ''}`}
            onClick={() => setView(view === 'settings' ? 'chat' : 'settings')}
            title={t('agent.settings')}
            aria-label={t('agent.settings')}
          >
            <span className="material-symbols-outlined" aria-hidden="true">settings</span>
          </button>
          <button
            type="button"
            className="agent-panel-icon-btn"
            onClick={() => newAgentSession()}
            title={t('agent.newConversation')}
            aria-label={t('agent.newConversation')}
          >
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
          </button>
          <button
            type="button"
            className={`agent-panel-icon-btn${view === 'history' ? ' is-active' : ''}`}
            onClick={handleShowHistory}
            title={t('agent.history')}
            aria-label={t('agent.history')}
          >
            <span className="material-symbols-outlined" aria-hidden="true">history</span>
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <AgentHistory onClose={() => setView('chat')} />
      ) : view === 'settings' ? (
        <AgentSettings onClose={() => setView('chat')} />
      ) : (
        <>
          <AgentMessages messages={agentMessages} loading={agentLoading} error={agentError} />
          <AgentInput />
        </>
      )}
    </div>
  );
}
