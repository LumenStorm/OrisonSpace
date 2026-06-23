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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only auto-scroll if the user is already near the bottom. Otherwise they've
    // scrolled up to read history and a forced scroll on every new event would
    // yank them back down.
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loading]);

  return (
    <div className="agent-messages" ref={containerRef}>
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
      {error && (
        <div className="agent-message-error">
          {renderError(error, t)}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// agentError holds either a raw backend message or an i18n key. Keys may carry a
// trailing detail as `agent.someKey: detail`; translate the key part and keep
// the detail. Anything not prefixed `agent.` is shown verbatim (backend text).
function renderError(error: string, t: (key: string) => string): string {
  if (!error.startsWith('agent.')) return error;
  const sep = error.indexOf(': ');
  if (sep === -1) return t(error);
  const key = error.slice(0, sep);
  const detail = error.slice(sep + 2);
  return `${t(key)}: ${detail}`;
}
