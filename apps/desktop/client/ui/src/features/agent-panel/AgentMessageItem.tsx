import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AgentMessage } from '../../shared/store/agentSlice';
import { WRITE_TOOLS } from '../../shared/store/agentDiffSlice';
import type { Attachment, SelectionAttachment } from '../../shared/types/attachment';
import { AgentToolCard } from './AgentToolCard';
import { DiffCard } from './DiffCard';
import { toolPresentation, toolLabel, parseChildTag } from './toolMeta';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

type Props = { message: AgentMessage };

function attachmentIcon(type: Attachment['type']): string {
  if (type === 'chapter') return 'description';
  return 'insert_drive_file';
}

function renderMarkdown(content: string): string {
  // Sanitize: agent/tool/file content reaches the renderer (which holds IPC
  // access to fs/git write tools), so raw model output must never run as HTML.
  const html = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(html);
}

/**
 * Compact citation chip for a pinned selection — a pointer to what the message
 * referenced, not a re-display of the full passage (the full text already went
 * to the model via the runtime). The quote marks are component-owned and the
 * inner text is truncated, so they stay balanced; the old chip showed the
 * `format_quote` glyph (a lone opening-quote icon) which read as an unbalanced
 * quote. Full text is available on hover.
 */
function SelectionReferenceChip({ ref }: { ref: SelectionAttachment }) {
  const raw = (ref.text ?? ref.label).replace(/\s+/g, ' ').trim();
  const preview = raw.length > 24 ? `${raw.slice(0, 24)}…` : raw;
  return (
    <span
      className="agent-attachment-chip agent-attachment-chip-quote"
      title={ref.text ?? ref.label}
    >
      <span className="agent-attachment-quote-text">“{preview}”</span>
    </span>
  );
}

/** Small leading badge for a nested skill / subagent execution step. */
function ChildBadge({ source, role, depth, t }: { source: 'skill' | 'subagent'; role: string; depth: number; t: (k: string) => string }) {
  const icon = source === 'skill' ? 'extension' : 'smart_toy';
  const sourceLabel = source === 'skill' ? t('agent.childSkill') : t('agent.childSubagent');
  return (
    <span className="agent-child-badge">
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      {sourceLabel} · {role}{depth > 1 ? ` · d${depth}` : ''}
    </span>
  );
}

export function AgentMessageItem({ message }: Props) {
  const { resolvedLocale } = useAppStore(useShallow((s) => ({ resolvedLocale: s.resolvedLocale })));
  const { t } = useI18n(resolvedLocale);
  const [stepsOpen, setStepsOpen] = useState(true);

  // Strip a child-execution tag (e.g. `[skill:story:d1] ...`) off assistant
  // content so it renders as an indented, labelled step instead of leaking the
  // raw tag into prose. The slice keeps injecting the tag; we only parse it here.
  const childTag = message.role === 'assistant' ? parseChildTag(message.content ?? '') : null;
  const assistantContent = childTag ? childTag.rest : message.content;

  const renderedHtml = useMemo(() => {
    if (message.role === 'assistant' && assistantContent) {
      return renderMarkdown(assistantContent);
    }
    return null;
  }, [message.role, assistantContent]);

  if (message.role === 'user') {
    return (
      <div className="agent-msg agent-msg-user">
        <div className="agent-msg-label">{t('agent.you')}</div>
        <div className="agent-msg-content">{message.content}</div>
        {message.references && message.references.length > 0 && (
          <div className="agent-msg-references">
            {message.references.map((ref) =>
              ref.type === 'selection' ? (
                <SelectionReferenceChip key={`selection-${ref.id}`} ref={ref} />
              ) : (
                <span key={`${ref.type}-${ref.id}`} className="agent-attachment-chip">
                  <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>
                    {attachmentIcon(ref.type)}
                  </span>
                  {ref.label}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    );
  }

  if (message.role === 'tool') {
    const results = message.toolResults ?? [];
    // A whole-chapter / passage / field write surfaces as its own DiffCard
    // (review affordance); everything else is an inspectable "work step".
    const diffResults = results.filter((r) => WRITE_TOOLS.includes(r.toolName ?? r.toolId ?? ''));
    const stepResults = results.filter((r) => !WRITE_TOOLS.includes(r.toolName ?? r.toolId ?? ''));
    const childTagOnTool = parseChildTag(message.content ?? '');

    return (
      <div className="agent-msg agent-msg-tool">
        {childTagOnTool && (
          <ChildBadge source={childTagOnTool.source} role={childTagOnTool.role} depth={childTagOnTool.depth} t={t} />
        )}
        {diffResults.map((r, i) => <DiffCard key={`diff-${i}`} result={r} />)}
        {stepResults.length > 0 && (
          <div className="agent-work-steps">
            {stepResults.length > 1 ? (
              <>
                <button
                  type="button"
                  className="agent-work-steps-header"
                  onClick={() => setStepsOpen((v) => !v)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {stepsOpen ? 'expand_more' : 'chevron_right'}
                  </span>
                  <span className="agent-work-steps-title">{t('agent.workSteps')}</span>
                  <span className="agent-work-steps-count">{t('agent.workStepsCount', { count: stepResults.length })}</span>
                </button>
                {stepsOpen && (
                  <div className="agent-work-steps-body">
                    {stepResults.map((r, i) => <AgentToolCard key={`step-${i}`} result={r} />)}
                  </div>
                )}
              </>
            ) : (
              stepResults.map((r, i) => <AgentToolCard key={`step-${i}`} result={r} />)
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="agent-msg agent-msg-assistant">
      <div className="agent-msg-label">{t('agent.agent')}</div>
      {childTag && (
        <ChildBadge source={childTag.source} role={childTag.role} depth={childTag.depth} t={t} />
      )}
      {renderedHtml && (
        <div className="agent-msg-content agent-msg-md" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      )}
      {message.toolCalls?.map((tc) => {
        const { icon } = toolPresentation(tc.name);
        return (
          <div key={tc.id} className="agent-tool-call-badge">
            <span className="material-symbols-outlined">{icon}</span>
            {toolLabel(tc.name, t)}
          </div>
        );
      })}
    </div>
  );
}
