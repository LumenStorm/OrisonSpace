import { type DragEvent, useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';

export function ChapterListPanel() {
  const { chapters, activeId, selectChapter, moveNovelChapter, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      chapters: s.novelChapters,
      activeId: s.activeChapterId,
      selectChapter: s.selectChapter,
      moveNovelChapter: s.moveNovelChapter,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback((e: DragEvent, index: number) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent, toIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const fromIndex = dragIndexRef.current;
    if (fromIndex !== null && fromIndex !== toIndex) {
      moveNovelChapter(fromIndex, toIndex);
    }
    dragIndexRef.current = null;
  }, [moveNovelChapter]);

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    dragIndexRef.current = null;
  }, []);

  if (chapters.length === 0) {
    return (
      <div className="novel-chapter-list-empty">
        <p>{t('novelChapter.emptyList')}</p>
      </div>
    );
  }

  return (
    <ul className="novel-chapter-list" aria-label="Chapter List">
      {chapters.map((ch: NovelChapterMeta, index: number) => {
        const active = ch.id === activeId;
        const isDragOver = dragOverIndex === index;
        return (
          <li
            key={ch.id}
            className={`novel-chapter-item${active ? ' novel-chapter-itemActive' : ''}${isDragOver ? ' novel-chapter-item--drag-over' : ''}`}
            data-status={ch.status}
            data-chapter-id={ch.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <button
              type="button"
              onClick={() => selectChapter(ch.id)}
              className="novel-chapter-button"
            >
              <span className="novel-chapter-title">{ch.title || t('novelChapter.unnamed', { id: ch.id })}</span>
              <span className="novel-chapter-status">{t(`novelChapter.statusValue.${ch.status}`)}</span>
              {ch.summary ? (
                <span className="novel-chapter-summary">{ch.summary}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
