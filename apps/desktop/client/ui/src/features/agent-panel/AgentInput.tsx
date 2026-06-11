import { useState, useCallback, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AgentMode } from '../../shared/store/types';
import type { Attachment } from '../../shared/types/attachment';
import { AgentConfirmCard } from './AgentConfirmCard';
import { AgentPassageResolveCard } from './AgentPassageResolveCard';

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
    chapters, openFiles,
    pendingAttachments, addAttachment, removeAttachment,
    pendingPassageResolve,
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
    chapters: s.chapters,
    openFiles: s.openFiles,
    pendingAttachments: s.pendingAttachments,
    addAttachment: s.addAttachment,
    removeAttachment: s.removeAttachment,
    pendingPassageResolve: s.pendingPassageResolve,
  })));

  const { t } = useI18n(resolvedLocale);
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAttachMenu]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || agentLoading) return;

    // Attachments are passed structurally by sendAgentMessage; no text flattening.
    setText('');
    sendAgentMessage(trimmed);
  }, [text, agentLoading, sendAgentMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddAttachment = (att: Attachment) => {
    addAttachment(att);
    setShowAttachMenu(false);
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
      {pendingPassageResolve && <AgentPassageResolveCard />}

      {pendingAttachments.length > 0 && (
        <div className="agent-input-attachments">
          {pendingAttachments.map((att) => {
            if (att.type === 'selection') {
              // Render selections as a quoted preview. The quote marks are added
              // by the component and the inner text is what gets truncated, so the
              // opening + closing quotes are always balanced — unlike the old
              // `slice(0,20)` label, which cut dialogue mid-quote.
              const raw = (att.text ?? att.label).replace(/\s+/g, ' ').trim();
              const preview = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
              return (
                <span
                  key={`selection-${att.id}`}
                  className="agent-attachment-chip agent-attachment-chip-quote"
                  title={att.text ?? att.label}
                >
                  <span className="agent-attachment-quote-text">“{preview}”</span>
                  <button type="button" className="agent-attachment-remove" onClick={() => removeAttachment(att.id)}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </span>
              );
            }
            return (
              <span key={`${att.type}-${att.id}`} className="agent-attachment-chip">
                <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>
                  {att.type === 'chapter' ? 'description' : 'insert_drive_file'}
                </span>
                {att.label}
                <button type="button" className="agent-attachment-remove" onClick={() => removeAttachment(att.id)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="agent-input-toolbar">
        <div className="agent-input-toolbar-left">
          <button
            type="button"
            className="agent-panel-icon-btn"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            title={t('agent.attach')}
          >
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          {showAttachMenu && (
            <div className="agent-attach-menu" ref={attachMenuRef}>
              <div className="agent-attach-section-title">{t('agent.attachChapter')}</div>
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  className="agent-attach-item"
                  onClick={() => handleAddAttachment({ type: 'chapter', id: ch.id, label: ch.title || ch.id })}
                >
                  <span className="material-symbols-outlined">description</span>
                  {ch.title || ch.id}
                </button>
              ))}
              {openFiles.length > 0 && (
                <>
                  <div className="agent-attach-section-title">{t('agent.attachFile')}</div>
                  {openFiles.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      className="agent-attach-item"
                      onClick={() => handleAddAttachment({ type: 'file', id: f.path, label: f.name })}
                    >
                      <span className="material-symbols-outlined">insert_drive_file</span>
                      {f.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <select
          className="agent-input-select"
          value={selectedModelKey}
          onChange={(e) => {
            const opt = modelOptions.find((o) => o.value === e.target.value);
            setAgentModelRef(opt?.ref ?? null);
          }}
          disabled={agentLoading}
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
