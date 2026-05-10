import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function ChapterTaskCardPanel() {
  const taskCard = useAppStore((s) => s.guidedNovelState?.currentTaskCard);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <article className="guided-novel-card">
      <h3>{t('guidedNovel.chapterTaskTitle')}</h3>
      <p>{taskCard?.summary ?? t('guidedNovel.noChapterTask')}</p>
    </article>
  );
}
