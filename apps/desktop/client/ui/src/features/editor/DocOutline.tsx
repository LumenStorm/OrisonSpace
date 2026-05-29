import { useMemo, useState } from 'react';

type HeadingEntry = { level: number; text: string; line: number };

function extractHeadings(content: string): HeadingEntry[] {
  const result: HeadingEntry[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      result.push({ level: match[1].length, text: match[2].trim(), line: i });
    }
  }
  return result;
}

export function DocOutline({ content, onJump }: { content: string; onJump?: (line: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (headings.length === 0) return null;

  return (
    <div className={`doc-outline${collapsed ? ' doc-outline--collapsed' : ''}`}>
      <button type="button" className="doc-outline-toggle" onClick={() => setCollapsed(!collapsed)}>
        <span className="material-symbols-outlined">{collapsed ? 'toc' : 'close'}</span>
      </button>
      {!collapsed && (
        <nav className="doc-outline-list">
          {headings.map((h, i) => (
            <button
              key={i}
              type="button"
              className="doc-outline-item"
              style={{ paddingLeft: `${(h.level - 1) * 0.6 + 0.4}rem` }}
              onClick={() => onJump?.(h.line)}
              title={h.text}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
