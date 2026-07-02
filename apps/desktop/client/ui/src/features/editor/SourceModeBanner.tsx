import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

/**
 * Info banner shown above the source editor when a markdown file was opened in
 * source mode because the rich text editor's schema would silently drop part
 * of its content (tables, images, raw HTML, front-matter) on the next save.
 */
export function SourceModeBanner() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="file-conflict-banner file-conflict-banner--info" role="status">
      <span className="material-symbols-outlined file-conflict-icon" aria-hidden="true">code</span>
      <div className="file-conflict-text">
        <strong>{t('fileEditor.sourceModeTitle')}</strong>
        <span>{t('fileEditor.sourceModeDesc')}</span>
      </div>
    </div>
  );
}
