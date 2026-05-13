import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type Props = {
  result: { toolId?: string; output?: string; metadata?: unknown };
};

export function DiffCard({ result }: Props) {
  const { pendingDiffs, acceptDiff, rejectDiff, agentMode, resolvedLocale } = useAppStore(useShallow((s) => ({
    pendingDiffs: s.pendingDiffs,
    acceptDiff: s.acceptDiff,
    rejectDiff: s.rejectDiff,
    agentMode: s.agentMode,
    resolvedLocale: s.resolvedLocale,
  })));
  const { t } = useI18n(resolvedLocale);

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

  return (
    <div className="agent-diff-card">
      <div className="agent-diff-card-header">
        <span className="material-symbols-outlined">edit_document</span>
        <span className="agent-diff-card-name">{fileName}</span>
        {!diff && <span className="agent-diff-card-status">✓ {t('agent.resolved')}</span>}
      </div>
      {result.output && (
        <div className="agent-diff-card-body">{result.output}</div>
      )}
      {diff && (
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
  );
}
