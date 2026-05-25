import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { StoryMemoryEntry } from '../../shared/store/novelChapterSlice';

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
  const { entries, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      entries: s.memoryEntries,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  const groups = useMemo(() => groupByChapter(entries), [entries]);

  if (entries.length === 0) {
    return (
      <div className="memory-panel memory-panel-empty">
        <p>{t('memory.empty')}</p>
      </div>
    );
  }

  return (
    <div className="memory-panel" aria-label="Memory Panel">
      {groups.map((g) => (
        <section key={g.chapterId || g.chapterNumber} className="memory-panel-group">
          <header className="memory-panel-group-header">
            <strong>{t('memory.chapterHeader', { n: g.chapterNumber })}</strong>
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
                    <span className="memory-entry-type">{t(`memory.typeValue.${entry.memoryType}`)}</span>
                    {entry.isForeshadow ? <span className="memory-entry-fs-badge">{t('memory.foreshadowBadge')}</span> : null}
                  </header>
                  <p className="memory-entry-content">{entry.content}</p>
                  {entry.relatedCharacters.length > 0 ? (
                    <p className="memory-entry-meta">{t('memory.charactersLabel', { names: entry.relatedCharacters.join('、') })}</p>
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
