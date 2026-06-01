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

type Attachment = { type: 'chapter' | 'file'; id: string; label: string };

export function AgentInput() {
  const {
    sendAgentMessage, cancelAgent, agentLoading,
    agentMode, setAgentMode,
    agentModelRef, setAgentModelRef,
    modelConfig, pendingToolConfirm, resolvedLocale,
    chapters, openFiles,
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
  })));

  const { t } = useI18n(resolvedLocale);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
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

    let content = trimmed;
    if (attachments.length > 0) {
      const contextLines = attachments.map((a) => `[Attached ${a.type}: ${a.label}]`).join('\n');
      content = `${contextLines}\n---\n${trimmed}`;
    }

    setText('');
    setAttachments([]);
    sendAgentMessage(content);
  }, [text, agentLoading, sendAgentMessage, attachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addAttachment = (att: Attachment) => {
    if (!attachments.find((a) => a.type === att.type && a.id === att.id)) {
      setAttachments([...attachments, att]);
    }
    setShowAttachMenu(false);
  };

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
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

      {attachments.length > 0 && (
        <div className="agent-input-attachments">
          {attachments.map((att, i) => (
            <span key={`${att.type}-${att.id}`} className="agent-attachment-chip">
              <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>
                {att.type === 'chapter' ? 'description' : 'insert_drive_file'}
              </span>
              {att.label}
              <button type="button" className="agent-attachment-remove" onClick={() => removeAttachment(i)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </span>
          ))}
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
                  onClick={() => addAttachment({ type: 'chapter', id: ch.id, label: ch.title || ch.id })}
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
                      onClick={() => addAttachment({ type: 'file', id: f.path, label: f.name })}
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
