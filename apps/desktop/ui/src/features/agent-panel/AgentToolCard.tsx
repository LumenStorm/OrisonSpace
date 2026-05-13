import { useState } from 'react';

type Props = {
  result: { toolId?: string; output?: string; metadata?: unknown };
};

export function AgentToolCard({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const imagePaths: string[] =
    result.metadata && typeof result.metadata === 'object' && 'paths' in result.metadata
      ? (result.metadata as { paths: string[] }).paths
      : [];

  return (
    <div className="agent-tool-card">
      <button
        type="button"
        className="agent-tool-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="material-symbols-outlined">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
        <span className="agent-tool-card-name">{result.toolId ?? 'tool'}</span>
        <span className="agent-tool-card-status">✓</span>
      </button>
      {expanded && (
        <div className="agent-tool-card-body">
          {imagePaths.map((p) => (
            <img key={p} src={`file://${p}`} className="agent-tool-card-image" alt="" />
          ))}
          {result.output && <pre className="agent-tool-card-output">{result.output}</pre>}
        </div>
      )}
    </div>
  );
}
