import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { AgentMessages } from './AgentMessages';
import { AgentInput } from './AgentInput';
import { AgentHistory } from './AgentHistory';
import { useEffect, useState } from 'react';

export function AgentPanel() {
  const {
    agentMessages, agentLoading, agentError,
    agentSkills, agentSkillError, latestSkillContinuation,
    newAgentSession, loadAgentSessions, loadAgentSkills, runAgentSkill, resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    agentMessages: s.agentMessages,
    agentLoading: s.agentLoading,
    agentError: s.agentError,
    agentSkills: s.agentSkills,
    agentSkillError: s.agentSkillError,
    latestSkillContinuation: s.latestSkillContinuation,
    newAgentSession: s.newAgentSession,
    loadAgentSessions: s.loadAgentSessions,
    loadAgentSkills: s.loadAgentSkills,
    runAgentSkill: s.runAgentSkill,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    void loadAgentSkills();
  }, [loadAgentSkills]);

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
          <div className="agent-skills-panel">
            <div className="agent-skills-header">
              <span className="agent-skills-title">{t('agent.skills')}</span>
              <button
                type="button"
                className="agent-panel-icon-btn"
                onClick={() => loadAgentSkills()}
                title={t('agent.refreshSkills')}
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
            {agentSkillError ? <div className="agent-message-error">{agentSkillError}</div> : null}
            <div className="agent-skills-list">
              {agentSkills.map((skill) => (
                <div key={skill.name} className="agent-skill-item">
                  <div className="agent-skill-meta">
                    <div className="agent-skill-name">{skill.name}</div>
                    <div className="agent-skill-description">{skill.description ?? skill.location}</div>
                  </div>
                  <button
                    type="button"
                    className="agent-skill-run-btn"
                    onClick={() => runAgentSkill(skill.name)}
                    disabled={agentLoading}
                    aria-label={`Run ${skill.name}`}
                  >
                    {t('agent.runSkill')}
                  </button>
                </div>
              ))}
            </div>
            {latestSkillContinuation ? (
              <div className="agent-continuation-card">
                <div className="agent-continuation-title">{t('agent.continuationReady')}</div>
                <div className="agent-continuation-meta">
                  {latestSkillContinuation.workflowState.activeSkill ?? 'skill'} · {latestSkillContinuation.workflowState.checkpoints.length}
                </div>
              </div>
            ) : null}
          </div>
          <AgentMessages messages={agentMessages} loading={agentLoading} error={agentError} />
          <AgentInput />
        </>
      )}
    </div>
  );
}
