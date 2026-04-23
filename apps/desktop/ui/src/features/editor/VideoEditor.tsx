import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function VideoEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="video-editor">
      <div className="video-preview">
        <div className="video-preview-placeholder">
          <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
          <p>{t('video.previewPlaceholder')}</p>
        </div>
      </div>
      <div className="video-timeline">
        <p className="video-timeline-empty">
          {t('video.noClips')}
        </p>
      </div>
    </div>
  );
}
