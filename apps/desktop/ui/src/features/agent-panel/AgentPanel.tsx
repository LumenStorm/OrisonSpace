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
    agentSkills, agentSkillError, latestSkillContinuation, agentContinuations, restoredSkillContinuation,
    newAgentSession, loadAgentSessions, loadAgentSkills, runAgentSkill,
    loadAgentContinuations, restoreLatestSkillContinuation, rerunLatestSkillContinuation, restoreAgentContinuation, resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    agentMessages: s.agentMessages,
    agentLoading: s.agentLoading,
    agentError: s.agentError,
    agentSkills: s.agentSkills,
    agentSkillError: s.agentSkillError,
    latestSkillContinuation: s.latestSkillContinuation,
    agentContinuations: s.agentContinuations,
    restoredSkillContinuation: s.restoredSkillContinuation,
    newAgentSession: s.newAgentSession,
    loadAgentSessions: s.loadAgentSessions,
    loadAgentSkills: s.loadAgentSkills,
    runAgentSkill: s.runAgentSkill,
    loadAgentContinuations: s.loadAgentContinuations,
    restoreLatestSkillContinuation: s.restoreLatestSkillContinuation,
    rerunLatestSkillContinuation: s.rerunLatestSkillContinuation,
    restoreAgentContinuation: s.restoreAgentContinuation,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    void loadAgentSkills();
  }, [loadAgentSkills]);

  useEffect(() => {
    void loadAgentContinuations();
  }, [loadAgentContinuations]);

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
                    <div className="agent-skill-tags">
                      <span className="agent-skill-tag">
                        {skill.source === 'external' ? t('agent.skillSourceExternal') : t('agent.skillSourceProject')}
                      </span>
                      <span className="agent-skill-tag">{skill.format}</span>
                    </div>
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
                {latestSkillContinuation.compacted.summary ? (
                  <div className="agent-continuation-summary">{latestSkillContinuation.compacted.summary}</div>
                ) : null}
                {latestSkillContinuation.workflowState.checkpoints.length > 0 ? (
                  <div className="agent-continuation-checkpoints">
                    {latestSkillContinuation.workflowState.checkpoints.map((checkpoint) => (
                      <span key={checkpoint} className="agent-continuation-checkpoint">{checkpoint}</span>
                    ))}
                  </div>
                ) : null}
                <div className="agent-continuation-actions">
                  <button
                    type="button"
                    className="agent-skill-run-btn"
                    onClick={restoreLatestSkillContinuation}
                  >
                    {t('agent.restoreContinuation')}
                  </button>
                  <button
                    type="button"
                    className="agent-skill-run-btn"
                    onClick={() => void rerunLatestSkillContinuation()}
                    disabled={agentLoading}
                  >
                    {t('agent.rerunContinuation')}
                  </button>
                </div>
              </div>
            ) : null}
            {restoredSkillContinuation ? (
              <div className="agent-workbench-card">
                <div className="agent-workbench-title">{t('agent.workflowWorkbench')}</div>
                <div className="agent-workbench-section">
                  <div className="agent-workbench-label">{t('agent.restoredContext')}</div>
                  <div className="agent-workbench-summary">{restoredSkillContinuation.summary || t('agent.noRestoredSummary')}</div>
                </div>
                <div className="agent-workbench-section">
                  <div className="agent-workbench-label">{t('agent.restoredSkill')}</div>
                  <div className="agent-workbench-summary">{restoredSkillContinuation.workflowState.activeSkill ?? '-'}</div>
                </div>
                {restoredSkillContinuation.workflowState.checkpoints.length > 0 ? (
                  <div className="agent-workbench-section">
                    <div className="agent-workbench-label">{t('agent.checkpoints')}</div>
                    <div className="agent-continuation-checkpoints">
                      {restoredSkillContinuation.workflowState.checkpoints.map((checkpoint) => (
                        <span key={checkpoint} className="agent-continuation-checkpoint">{checkpoint}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {restoredSkillContinuation.tail.length > 0 ? (
                  <div className="agent-workbench-section">
                    <div className="agent-workbench-label">{t('agent.recentContextTail')}</div>
                    <div className="agent-workbench-tail-list">
                      {restoredSkillContinuation.tail.map((item) => (
                        <div key={item.id} className="agent-workbench-tail-item">
                          <span className="agent-workbench-tail-role">{item.role}</span>
                          <span className="agent-workbench-tail-content">{item.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="agent-workbench-card">
              <div className="agent-workbench-title">{t('agent.recentContinuations')}</div>
              {agentContinuations.length === 0 ? (
                <div className="agent-workbench-summary">{t('agent.noContinuations')}</div>
              ) : (
                <div className="agent-resume-list">
                  {agentContinuations.map((continuation) => (
                    <div key={continuation.continuationId} className="agent-resume-item">
                      <div className="agent-resume-meta">
                        <div className="agent-resume-skill">{continuation.workflowState.activeSkill ?? 'skill'}</div>
                        <div className="agent-resume-summary">{continuation.summary || t('agent.noRestoredSummary')}</div>
                      </div>
                      <button
                        type="button"
                        className="agent-skill-run-btn"
                        onClick={() => void restoreAgentContinuation(continuation.continuationId)}
                      >
                        {t('agent.restoreRun')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <AgentMessages messages={agentMessages} loading={agentLoading} error={agentError} />
          <AgentInput />
        </>
      )}
    </div>
  );
}
