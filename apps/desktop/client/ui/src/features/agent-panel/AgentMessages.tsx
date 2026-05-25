import { useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AgentMessage } from '../../shared/store/agentSlice';
import { AgentMessageItem } from './AgentMessageItem';

type Props = {
  messages: AgentMessage[];
  loading: boolean;
  error: string | null;
};

export function AgentMessages({ messages, loading, error }: Props) {
  const { resolvedLocale } = useAppStore(useShallow((s) => ({ resolvedLocale: s.resolvedLocale })));
  const { t } = useI18n(resolvedLocale);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  return (
    <div className="agent-messages">
      {messages.length === 0 && !loading && (
        <div className="agent-messages-empty">
          <span className="material-symbols-outlined">smart_toy</span>
          <p>{t('agent.emptyHint')}</p>
        </div>
      )}
      {messages.map((msg) => (
        <AgentMessageItem key={msg.id} message={msg} />
      ))}
      {loading && (
        <div className="agent-message-loading">
          <span className="agent-loading-dot" />
          <span className="agent-loading-dot" />
          <span className="agent-loading-dot" />
        </div>
      )}
      {error && <div className="agent-message-error">{error}</div>}
      <div ref={bottomRef} />
    </div>
  );
}
