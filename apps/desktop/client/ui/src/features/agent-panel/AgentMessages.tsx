import { useRef, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AgentMessage } from '../../shared/store/agentSlice';
import { AgentMessageItem } from './AgentMessageItem';
import { ChildExecutionGroup } from './ChildExecutionGroup';
import { parseChildTag } from './toolMeta';

type Props = {
  messages: AgentMessage[];
  loading: boolean;
  error: string | null;
};

type MessageGroup =
  | { type: 'single'; message: AgentMessage; index: number }
  | { type: 'child-group'; source: 'skill' | 'subagent'; role: string; depth: number; messages: AgentMessage[] };

function groupMessages(messages: AgentMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    const tag = parseChildTag(msg.content ?? '');
    if (!tag) {
      groups.push({ type: 'single', message: msg, index: i });
      i++;
      continue;
    }
    const batch: AgentMessage[] = [msg];
    let j = i + 1;
    while (j < messages.length) {
      const nextTag = parseChildTag(messages[j].content ?? '');
      if (!nextTag || nextTag.source !== tag.source || nextTag.role !== tag.role || nextTag.depth !== tag.depth) break;
      batch.push(messages[j]);
      j++;
    }
    if (batch.length >= 2) {
      groups.push({ type: 'child-group', source: tag.source, role: tag.role, depth: tag.depth, messages: batch });
    } else {
      groups.push({ type: 'single', message: msg, index: i });
    }
    i = j;
  }
  return groups;
}

export function AgentMessages({ messages, loading, error }: Props) {
  const { resolvedLocale } = useAppStore(useShallow((s) => ({ resolvedLocale: s.resolvedLocale })));
  const { t } = useI18n(resolvedLocale);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
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
      {grouped.map((group, gi) => {
        if (group.type === 'single') {
          return (
            <AgentMessageItem
              key={group.message.id}
              message={group.message}
              isLatest={group.index === messages.length - 1}
            />
          );
        }
        return (
          <ChildExecutionGroup
            key={`child-${gi}-${group.source}-${group.role}`}
            source={group.source}
            role={group.role}
            depth={group.depth}
            messages={group.messages}
            isLatestGroup={group.messages[group.messages.length - 1] === messages[messages.length - 1]}
          />
        );
      })}
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
