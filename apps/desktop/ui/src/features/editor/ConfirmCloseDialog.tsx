import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';

type Props = {
  fileName: string;
  filePath: string;
  onClose: () => void;
};

export function ConfirmCloseDialog({ fileName, filePath, onClose }: Props) {
  const { locale, saveFile, closeFile } = useAppStore(
    useShallow((s) => ({
      locale: s.resolvedLocale,
      saveFile: s.saveFile,
      closeFile: s.closeFile,
    })),
  );
  const { t } = useI18n(locale);

  const handleSaveAndClose = async () => {
    const ok = await saveFile(filePath);
    if (ok) {
      closeFile(filePath);
    }
    onClose();
  };

  const handleDiscard = () => {
    closeFile(filePath);
    onClose();
  };

  return (
    <div className="topbar-new-dialog-overlay" onClick={onClose}>
      <div className="settings-dialog settings-dialog-sm" onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title">{t('fileEditor.confirmCloseTitle')}</h2>
          <button type="button" className="settings-dialog-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="settings-dialog-body about-dialog-body">
          <p className="about-dialog-desc">
            {t('fileEditor.confirmCloseDesc').replace('{name}', fileName)}
          </p>
          <div className="update-actions">
            <button type="button" className="update-btn-secondary" onClick={onClose}>
              {t('fileEditor.cancel')}
            </button>
            <button type="button" className="update-btn-secondary" onClick={handleDiscard}>
              {t('fileEditor.dontSave')}
            </button>
            <button type="button" className="update-btn-primary" onClick={handleSaveAndClose}>
              {t('fileEditor.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
