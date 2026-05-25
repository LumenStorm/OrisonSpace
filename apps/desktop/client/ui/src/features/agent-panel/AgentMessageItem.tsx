import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AgentMessage } from '../../shared/store/agentSlice';
import { AgentToolCard } from './AgentToolCard';
import { DiffCard } from './DiffCard';

const WRITE_TOOLS = ['chapter_write', 'write_file', 'outline_update'];

type Props = { message: AgentMessage };

export function AgentMessageItem({ message }: Props) {
  const { resolvedLocale } = useAppStore(useShallow((s) => ({ resolvedLocale: s.resolvedLocale })));
  const { t } = useI18n(resolvedLocale);

  if (message.role === 'user') {
    return (
      <div className="agent-msg agent-msg-user">
        <div className="agent-msg-label">{t('agent.you')}</div>
        <div className="agent-msg-content">{message.content}</div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="agent-msg agent-msg-tool">
        {message.toolResults?.map((r, i) => {
          if (WRITE_TOOLS.includes(r.toolId ?? '')) {
            return <DiffCard key={i} result={r} />;
          }
          return <AgentToolCard key={i} result={r} />;
        })}
      </div>
    );
  }

  return (
    <div className="agent-msg agent-msg-assistant">
      <div className="agent-msg-label">{t('agent.agent')}</div>
      {message.content && <div className="agent-msg-content">{message.content}</div>}
      {message.toolCalls?.map((tc) => (
        <div key={tc.id} className="agent-tool-call-badge">
          <span className="material-symbols-outlined">build</span>
          {tc.name}
        </div>
      ))}
    </div>
  );
}
