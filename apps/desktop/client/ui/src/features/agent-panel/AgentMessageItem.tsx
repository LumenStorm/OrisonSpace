import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AgentMessage } from '../../shared/store/agentSlice';
import { WRITE_TOOLS } from '../../shared/store/agentDiffSlice';
import type { Attachment } from '../../shared/types/attachment';
import { AgentToolCard } from './AgentToolCard';
import { DiffCard } from './DiffCard';
import { marked } from 'marked';

type Props = { message: AgentMessage };

function attachmentIcon(type: Attachment['type']): string {
  if (type === 'chapter') return 'description';
  if (type === 'selection') return 'format_quote';
  return 'insert_drive_file';
}

function renderMarkdown(content: string): string {
  return marked.parse(content, { async: false }) as string;
}

export function AgentMessageItem({ message }: Props) {
  const { resolvedLocale } = useAppStore(useShallow((s) => ({ resolvedLocale: s.resolvedLocale })));
  const { t } = useI18n(resolvedLocale);

  const renderedHtml = useMemo(() => {
    if (message.role === 'assistant' && message.content) {
      return renderMarkdown(message.content);
    }
    return null;
  }, [message.role, message.content]);

  if (message.role === 'user') {
    return (
      <div className="agent-msg agent-msg-user">
        <div className="agent-msg-label">{t('agent.you')}</div>
        <div className="agent-msg-content">{message.content}</div>
        {message.references && message.references.length > 0 && (
          <div className="agent-msg-references">
            {message.references.map((ref) => (
              <span key={`${ref.type}-${ref.id}`} className="agent-attachment-chip">
                <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>
                  {attachmentIcon(ref.type)}
                </span>
                {ref.label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="agent-msg agent-msg-tool">
        {message.toolResults?.map((r, i) => {
          const toolId = r.toolName ?? r.toolId ?? '';
          if (WRITE_TOOLS.includes(toolId)) {
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
      {renderedHtml && (
        <div className="agent-msg-content agent-msg-md" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      )}
      {message.toolCalls?.map((tc) => (
        <div key={tc.id} className="agent-tool-call-badge">
          <span className="material-symbols-outlined">build</span>
          {tc.name}
        </div>
      ))}
    </div>
  );
}
