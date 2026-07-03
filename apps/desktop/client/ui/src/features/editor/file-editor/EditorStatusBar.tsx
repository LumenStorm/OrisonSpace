import { useMemo, useState } from 'react';
import { countMarkup } from '../../../shared/utils/wordCount';
import { useAppStore } from '../../../shared/store/appStore';

type Props = { content: string; fileType: string };

export function EditorStatusBar({ content, fileType }: Props) {
  const [expanded, setExpanded] = useState(false);
  const showWordCount = useAppStore((s) => s.showWordCount);
  const wordCountGoal = useAppStore((s) => s.wordCountGoal);
  // content 可能是纯文本（PlainText/Code）或 markdown 文本，统一先剥标签再统计。
  const stats = useMemo(() => countMarkup(content), [content]);
  const readingMin = Math.max(1, Math.ceil(stats.words / 250));
  const goalPct = wordCountGoal > 0 ? Math.min(100, Math.round((stats.chars / wordCountGoal) * 100)) : 0;

  return (
    <div className="editor-status-bar">
      <span className="editor-status-type">{fileType}</span>
      {showWordCount && (
      <div className="editor-status-right">
        <button
          type="button"
          className="editor-status-word-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {wordCountGoal > 0 ? (
            <>
              {stats.chars} / {wordCountGoal} 字
              <span className="editor-status-goal-pct">{goalPct}%</span>
            </>
          ) : (
            <>{stats.chars} 字</>
          )}
        </button>
        {expanded && (
          <div className="editor-status-detail">
            <span>{stats.totalChars} 字符</span>
            <span>{stats.lines} 行</span>
            <span>{stats.paragraphs} 段落</span>
            <span>~{readingMin} 分钟阅读</span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
