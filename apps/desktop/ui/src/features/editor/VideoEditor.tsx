import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

const mockClips = [
  { id: 'clip-001', label: 'Shot 01 — Establishing' },
  { id: 'clip-002', label: 'Shot 02 — Mid shot' },
  { id: 'clip-003', label: 'Shot 03 — Close-up' },
];

export function VideoEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const [prompt, setPrompt] = useState('');

  return (
    <div className="video-editor">
      <div className="video-preview">
        <div className="video-preview-placeholder">
          <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
          <p>{t('video.previewPlaceholder')}</p>
        </div>
      </div>

      <div className="video-gen-input">
        <textarea
          className="video-gen-prompt"
          placeholder={t('video.promptPlaceholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <button type="button" className="video-gen-btn" disabled={!prompt.trim()}>
          <span className="material-symbols-outlined" aria-hidden="true">movie_edit</span>
          {t('video.generate')}
        </button>
      </div>

      <div className="video-clips-section">
        <h3 className="video-clips-title">{t('video.clips')}</h3>
        <div className="video-clips-grid">
          {mockClips.map((clip) => (
            <div key={clip.id} className="video-clip-card">
              <div className="video-clip-thumb">
                <span className="material-symbols-outlined" aria-hidden="true">movie</span>
              </div>
              <span className="video-clip-label">{clip.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
