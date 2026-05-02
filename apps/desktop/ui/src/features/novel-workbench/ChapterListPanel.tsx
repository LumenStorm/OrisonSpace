import { useAppStore } from '../../shared/store/appStore';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';

const STATUS_LABEL: Record<NovelChapterMeta['status'], string> = {
  draft: '草稿',
  generating: '生成中',
  revised: '已修订',
  final: '已定稿',
};

export function ChapterListPanel() {
  const chapters = useAppStore((s) => s.novelChapters);
  const activeId = useAppStore((s) => s.activeChapterId);
  const selectChapter = useAppStore((s) => s.selectChapter);

  if (chapters.length === 0) {
    return (
      <div className="novel-chapter-list-empty">
        <p>当前项目暂无章节。</p>
      </div>
    );
  }

  return (
    <ul className="novel-chapter-list" aria-label="Chapter List">
      {chapters.map((ch) => {
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
              <span className="novel-chapter-title">{ch.title || `（未命名 ${ch.id}）`}</span>
              <span className="novel-chapter-status">{STATUS_LABEL[ch.status]}</span>
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
