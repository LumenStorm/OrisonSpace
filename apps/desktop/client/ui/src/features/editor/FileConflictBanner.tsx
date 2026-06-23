import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { FileTab } from '../../shared/store/fileTabsSlice';

/**
 * Banner shown above a file editor when the file changed (or was deleted) on
 * disk outside the app while the tab has unsaved edits. Mirrors VSCode's
 * "file changed on disk" prompt: the user reloads from disk (discarding their
 * edits) or keeps their version (next save overwrites disk).
 */
export function FileConflictBanner({ file }: { file: FileTab }) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const reloadFile = useAppStore((s) => s.reloadFile);
  const keepLocalVersion = useAppStore((s) => s.keepLocalVersion);
  const saveFile = useAppStore((s) => s.saveFile);
  const { t } = useI18n(resolvedLocale);

  if (!file.externalState) return null;

  const deleted = file.externalState === 'deleted';

  return (
    <div className="file-conflict-banner" role="alert">
      <span className="material-symbols-outlined file-conflict-icon" aria-hidden="true">
        {deleted ? 'delete_forever' : 'sync_problem'}
      </span>
      <div className="file-conflict-text">
        <strong>{t(deleted ? 'fileEditor.externalDeletedTitle' : 'fileEditor.externalChangedTitle')}</strong>
        <span>{t(deleted ? 'fileEditor.externalDeletedDesc' : 'fileEditor.externalChangedDesc')}</span>
      </div>
      <div className="file-conflict-actions">
        {deleted ? (
          <button
            type="button"
            className="file-conflict-btn file-conflict-btn--primary"
            onClick={() => { void saveFile(file.path).then(() => keepLocalVersion(file.path)); }}
          >
            {t('fileEditor.saveAnyway')}
          </button>
        ) : (
          <button
            type="button"
            className="file-conflict-btn file-conflict-btn--primary"
            onClick={() => { void reloadFile(file.path); }}
          >
            {t('fileEditor.reloadFromDisk')}
          </button>
        )}
        <button
          type="button"
          className="file-conflict-btn"
          onClick={() => keepLocalVersion(file.path)}
        >
          {t('fileEditor.keepMine')}
        </button>
      </div>
    </div>
  );
}
