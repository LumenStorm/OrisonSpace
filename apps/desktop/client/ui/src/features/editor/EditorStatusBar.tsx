import { useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

function countWords(html: string): { words: number; chars: number } {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return { words: 0, chars: 0 };
  const chars = text.length;
  const words = text.split(/[\s　]+/).filter(Boolean).length;
  return { words, chars };
}

export function EditorStatusBar() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const chapters = useAppStore((s) => s.chapters);
  const activeChapterId = useAppStore((s) => s.activeChapterId);
  const { t } = useI18n(resolvedLocale);

  const activeChapter = chapters.find((c) => c.id === activeChapterId);
  const { words, chars } = useMemo(
    () => countWords(activeChapter?.content ?? ''),
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
