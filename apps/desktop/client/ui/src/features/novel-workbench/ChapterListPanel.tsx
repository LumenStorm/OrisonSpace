import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';

export function ChapterListPanel() {
  const { chapters, activeId, selectChapter, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      chapters: s.novelChapters,
      activeId: s.activeChapterId,
      selectChapter: s.selectChapter,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  if (chapters.length === 0) {
    return (
      <div className="novel-chapter-list-empty">
        <p>{t('novelChapter.emptyList')}</p>
      </div>
    );
  }

  return (
    <ul className="novel-chapter-list" aria-label="Chapter List">
      {chapters.map((ch: NovelChapterMeta) => {
        const active = ch.id === activeId;
        return (
          <li
            key={ch.id}
            className={`novel-chapter-item${active ? ' novel-chapter-itemActive' : ''}`}
            data-status={ch.status}
            data-chapter-id={ch.id}
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
