import { useAppStore } from '../../../shared/store/appStore';
import { useI18n } from '../../../shared/i18n/useI18n';
import type { FileTab } from '../../../shared/store/fileTabsSlice';

export function ReadOnlyPreview({ file }: { file: FileTab }) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="file-editor-readonly">
      <span className="material-symbols-outlined" aria-hidden="true">visibility</span>
      <p>{t('fileEditor.readOnly')}</p>
      <pre className="file-editor-readonly-content">{file.content}</pre>
    </div>
  );
}
