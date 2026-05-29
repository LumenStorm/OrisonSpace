import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { SideBySideDiff } from './SideBySideDiff';

type Props = {
  result: { toolId?: string; output?: string; metadata?: unknown };
};

export function DiffCard({ result }: Props) {
  const { pendingDiffs, acceptDiff, rejectDiff, agentMode, resolvedLocale, chapters } = useAppStore(useShallow((s) => ({
    pendingDiffs: s.pendingDiffs,
    acceptDiff: s.acceptDiff,
    rejectDiff: s.rejectDiff,
    agentMode: s.agentMode,
    resolvedLocale: s.resolvedLocale,
    chapters: s.chapters,
  })));
  const { t } = useI18n(resolvedLocale);
  const [expanded, setExpanded] = useState(false);

  const meta = result.metadata as { fileName?: string; content?: string } | undefined;
  const fileName = meta?.fileName ?? result.toolId ?? 'file';
  const diff = pendingDiffs.find((d) => d.fileName === meta?.fileName);

  if (agentMode === 'auto' || agentMode === 'readonly') {
    return (
      <div className="agent-diff-card">
        <div className="agent-diff-card-header">
          <span className="material-symbols-outlined">edit_document</span>
          <span className="agent-diff-card-name">{fileName}</span>
          <span className="agent-diff-card-status">
            {agentMode === 'auto' ? `✓ ${t('agent.applied')}` : '—'}
          </span>
        </div>
      </div>
    );
  }

  const oldContent = diff
    ? (chapters.find((c) => (diff.chapterId ? c.id === diff.chapterId : c.title.includes(diff.fileName.replace('.md', ''))))?.content ?? '')
    : '';

  return (
    <>
      <div className="agent-diff-card">
        <div className="agent-diff-card-header">
          <span className="material-symbols-outlined">edit_document</span>
          <span className="agent-diff-card-name">{fileName}</span>
          {!diff && <span className="agent-diff-card-status">✓ {t('agent.resolved')}</span>}
          {diff && (
            <button type="button" className="agent-diff-expand-btn" onClick={() => setExpanded(!expanded)} title="Side-by-side diff">
              <span className="material-symbols-outlined">{expanded ? 'collapse_all' : 'compare'}</span>
            </button>
          )}
        </div>
        {result.output && !expanded && (
          <div className="agent-diff-card-body">{result.output}</div>
        )}
        {diff && !expanded && (
          <div className="agent-diff-card-actions">
            <button type="button" className="agent-diff-btn agent-diff-btn-accept" onClick={() => acceptDiff(diff.id)}>
              {t('agent.accept')}
            </button>
            <button type="button" className="agent-diff-btn agent-diff-btn-reject" onClick={() => rejectDiff(diff.id)}>
              {t('agent.reject')}
            </button>
          </div>
        )}
      </div>
      {expanded && diff && (
        <SideBySideDiff diff={diff} oldContent={oldContent} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}
