import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AgentMessage } from '../../shared/store/agentSlice';
import { AgentMessageItem } from './AgentMessageItem';

type Props = {
  source: 'skill' | 'subagent';
  role: string;
  depth: number;
  messages: AgentMessage[];
  isLatestGroup?: boolean;
};

export function ChildExecutionGroup({ source, role, depth, messages, isLatestGroup }: Props) {
  const { resolvedLocale } = useAppStore(useShallow((s) => ({ resolvedLocale: s.resolvedLocale })));
  const { t } = useI18n(resolvedLocale);
  const [open, setOpen] = useState(false);

  const icon = source === 'skill' ? 'extension' : 'smart_toy';
  const sourceLabel = source === 'skill' ? t('agent.childSkill') : t('agent.childSubagent');

  return (
    <div className="agent-child-group" style={{ '--depth': depth } as React.CSSProperties}>
      <button
        type="button"
        className="agent-child-group-header"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <span className="agent-child-group-label">{sourceLabel} · {role}</span>
        {depth > 1 && <span className="agent-child-group-depth">d{depth}</span>}
        <span className="agent-child-group-count">{messages.length}</span>
        <span className="material-symbols-outlined agent-child-group-chevron" aria-hidden="true">
          {open ? 'expand_more' : 'chevron_right'}
        </span>
      </button>
      {open && (
        <div className="agent-child-group-body">
          {messages.map((msg, i) => (
            <AgentMessageItem
              key={msg.id}
              message={msg}
              isLatest={isLatestGroup && i === messages.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
