import { useMemo, useState } from 'react';

type Props = { content: string; fileType: string };

function computeStats(content: string) {
  const chars = content.length;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lines = content.split('\n').length;
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const readingMin = Math.max(1, Math.ceil(words / 250));
  return { chars, words, lines, paragraphs, readingMin };
}

export function EditorStatusBar({ content, fileType }: Props) {
  const [expanded, setExpanded] = useState(false);
  const stats = useMemo(() => computeStats(content), [content]);

  return (
    <div className="editor-status-bar">
      <span className="editor-status-type">{fileType}</span>
      <div className="editor-status-right">
        <button
          type="button"
          className="editor-status-word-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {stats.words} 字
        </button>
        {expanded && (
          <div className="editor-status-detail">
            <span>{stats.chars} 字符</span>
            <span>{stats.lines} 行</span>
            <span>{stats.paragraphs} 段落</span>
            <span>~{stats.readingMin} 分钟阅读</span>
          </div>
        )}
      </div>
    </div>
  );
}
