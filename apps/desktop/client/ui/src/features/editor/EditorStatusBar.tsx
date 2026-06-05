import { useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { countMarkup } from '../../shared/utils/wordCount';

export function EditorStatusBar() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const chapters = useAppStore((s) => s.chapters);
  const activeChapterId = useAppStore((s) => s.activeChapterId);
  const { t } = useI18n(resolvedLocale);

  const activeChapter = chapters.find((c) => c.id === activeChapterId);
  // 章节 content 是 HTML，先剥标签再统计。
  const { words, chars } = useMemo(
    () => countMarkup(activeChapter?.content ?? ''),
    [activeChapter?.content],
  );

  if (!activeChapter) return null;

  return (
    <div className="editor-status-bar">
      <span>{t('editor.words')}: {words}</span>
      <span>{t('editor.chars')}: {chars}</span>
    </div>
  );
}
