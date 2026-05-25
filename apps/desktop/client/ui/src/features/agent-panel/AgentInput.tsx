import { useState, useCallback, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AgentMode } from '../../shared/store/types';
import { AgentConfirmCard } from './AgentConfirmCard';

const MODE_KEYS: { value: AgentMode; i18nKey: string }[] = [
  { value: 'readonly', i18nKey: 'agent.modeReadonly' },
  { value: 'suggest', i18nKey: 'agent.modeSuggest' },
  { value: 'auto', i18nKey: 'agent.modeAuto' },
];

export function AgentInput() {
  const {
    sendAgentMessage, cancelAgent, agentLoading,
    agentMode, setAgentMode,
    agentModelRef, setAgentModelRef,
    modelConfig, pendingToolConfirm, resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    sendAgentMessage: s.sendAgentMessage,
    cancelAgent: s.cancelAgent,
    agentLoading: s.agentLoading,
    agentMode: s.agentMode,
    setAgentMode: s.setAgentMode,
    agentModelRef: s.agentModelRef,
    setAgentModelRef: s.setAgentModelRef,
    modelConfig: s.modelConfig,
    pendingToolConfirm: s.pendingToolConfirm,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || agentLoading) return;
    setText('');
    sendAgentMessage(trimmed);
  }, [text, agentLoading, sendAgentMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modelOptions = modelConfig.keys.flatMap((key) =>
    key.models.filter((m) => m.enabled && m.capability === 'text').map((m) => ({
      value: `${key.id}:${m.id}`,
      label: `${key.name} · ${m.alias}`,
      ref: { keyId: key.id, modelId: m.id },
    }))
  );

  const selectedModelKey = agentModelRef ? `${agentModelRef.keyId}:${agentModelRef.modelId}` : '';

  return (
    <div className="agent-input-area">
      {pendingToolConfirm && <AgentConfirmCard />}
      <div className="agent-input-toolbar">
        <select
          className="agent-input-select"
          value={selectedModelKey}
          onChange={(e) => {
            const opt = modelOptions.find((o) => o.value === e.target.value);
            setAgentModelRef(opt?.ref ?? null);
          }}
          title={t('agent.selectModel')}
        >
          <option value="">{t('agent.selectModel')}</option>
          {modelOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          className="agent-input-select"
          value={agentMode}
          onChange={(e) => setAgentMode(e.target.value as AgentMode)}
        >
          {MODE_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{t(o.i18nKey)}</option>
          ))}
        </select>
      </div>
      <div className="agent-input-row">
        <textarea
          ref={textareaRef}
          className="agent-input-textarea"
          placeholder={t('agent.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={agentLoading}
        />
        {agentLoading ? (
          <button type="button" className="agent-input-btn" onClick={cancelAgent} title={t('agent.stop')}>
            <span className="material-symbols-outlined">stop</span>
          </button>
        ) : (
          <button type="button" className="agent-input-btn" onClick={handleSend} title={t('agent.send')} disabled={!text.trim()}>
            <span className="material-symbols-outlined">send</span>
          </button>
        )}
      </div>
    </div>
  );
}
