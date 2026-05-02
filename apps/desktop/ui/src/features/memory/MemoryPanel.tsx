import { useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import type { StoryMemoryEntry } from '../../shared/store/novelChapterSlice';

const TYPE_LABEL: Record<string, string> = {
  chapter_summary: '章节摘要',
  character_mentions: '角色提及',
  foreshadow_seed: '悬念线索',
};

function groupByChapter(entries: StoryMemoryEntry[]): Array<{ chapterNumber: number; chapterId: string; entries: StoryMemoryEntry[] }> {
  const groups = new Map<string, { chapterNumber: number; chapterId: string; entries: StoryMemoryEntry[] }>();
  for (const entry of entries) {
    const key = entry.chapterId || `__ch_${entry.chapterNumber}`;
    if (!groups.has(key)) {
      groups.set(key, { chapterNumber: entry.chapterNumber, chapterId: entry.chapterId, entries: [] });
    }
    groups.get(key)!.entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => a.chapterNumber - b.chapterNumber);
}

export function MemoryPanel() {
  const entries = useAppStore((s) => s.memoryEntries);

  const groups = useMemo(() => groupByChapter(entries), [entries]);

  if (entries.length === 0) {
    return (
      <div className="memory-panel memory-panel-empty">
        <p>暂无记忆条目。生成章节后将自动归档。</p>
      </div>
    );
  }

  return (
    <div className="memory-panel" aria-label="Memory Panel">
      {groups.map((g) => (
        <section key={g.chapterId || g.chapterNumber} className="memory-panel-group">
          <header className="memory-panel-group-header">
            <strong>第{g.chapterNumber}章</strong>
            <span className="memory-panel-group-id">{g.chapterId}</span>
          </header>
          <ul className="memory-panel-list">
            {g.entries.map((entry) => (
              <li key={entry.id}>
                <article
                  className="memory-entry"
                  data-foreshadow={entry.isForeshadow ? 'true' : 'false'}
                  data-memory-type={entry.memoryType}
                >
                  <header className="memory-entry-header">
                    <strong>{entry.title}</strong>
                    <span className="memory-entry-type">{TYPE_LABEL[entry.memoryType] ?? entry.memoryType}</span>
                    {entry.isForeshadow ? <span className="memory-entry-fs-badge">伏笔</span> : null}
                  </header>
                  <p className="memory-entry-content">{entry.content}</p>
                  {entry.relatedCharacters.length > 0 ? (
                    <p className="memory-entry-meta">角色：{entry.relatedCharacters.join('、')}</p>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
