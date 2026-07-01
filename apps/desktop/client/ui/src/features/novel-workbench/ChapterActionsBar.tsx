import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { Tooltip } from '../../shared/components/Tooltip';

export function ChapterActionsBar() {
  const { activeId, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      activeId: s.activeChapterId,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);

  if (!activeId) {
    return (
      <div className="novel-chapter-actions-bar novel-chapter-actions-empty">
        <p>{t('novelChapter.selectChapter')}</p>
      </div>
    );
  }

  return (
    <div className="novel-chapter-actions-bar" aria-label="Chapter Actions">
      <Tooltip label={t('novelChapter.rebuilding')} placement="bottom">
        <span className="novel-chapter-actions-disabled-hint">
          {t('novelChapter.actionsUnavailable')}
        </span>
      </Tooltip>
    </div>
  );
}
