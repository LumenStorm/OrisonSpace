import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { toolPresentation, toolLabel, toolSummary } from './toolMeta';

type Props = {
  result: { toolId?: string; toolName?: string; output?: string; metadata?: unknown };
};

export function AgentToolCard({ result }: Props) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const [expanded, setExpanded] = useState(false);
  const imagePaths: string[] =
    result.metadata && typeof result.metadata === 'object' && 'paths' in result.metadata
      ? (result.metadata as { paths: string[] }).paths
      : [];

  // A failed tool surfaces its error as a result whose output starts with
  // "Error:" (see agent loop / tool handlers). Reflect that instead of always
  // showing a green check, so a failure isn't mistaken for success.
  const isError = typeof result.output === 'string' && /^\s*error\b/i.test(result.output);

  const toolId = result.toolName ?? result.toolId ?? '';
  const { icon } = toolPresentation(toolId);
  const label = toolLabel(toolId, t);
  const summary = toolSummary(result);

  return (
    <div className={`agent-tool-card${isError ? ' agent-tool-card--error' : ''}`}>
      <button
        type="button"
        className="agent-tool-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="material-symbols-outlined agent-tool-card-icon" aria-hidden="true">{icon}</span>
        <span className="agent-tool-card-name">{label}</span>
        {summary && <span className="agent-tool-card-summary" title={summary}>{summary}</span>}
        <span className={`agent-tool-card-status${isError ? ' agent-tool-card-status--error' : ''}`}>
          {isError ? '⚠' : '✓'}
        </span>
        <span className="material-symbols-outlined agent-tool-card-chevron" aria-hidden="true">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {expanded && (
        <div className="agent-tool-card-body">
          {imagePaths.map((p) => (
            <img key={p} src={`orison-file:///${p}`} className="agent-tool-card-image" alt="" />
          ))}
          {result.output && <pre className="agent-tool-card-output">{result.output}</pre>}
        </div>
      )}
    </div>
  );
}
