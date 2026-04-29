import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

const mockResults = [
  { id: 'img-001', label: 'Variant A' },
  { id: 'img-002', label: 'Variant B' },
  { id: 'img-003', label: 'Variant C' },
  { id: 'img-004', label: 'Variant D' },
];

export function ImageGenEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const [prompt, setPrompt] = useState('');

  return (
    <div className="image-gen-editor">
      <div className="image-gen-input-section">
        <h3 className="image-gen-section-title">{t('imageGen.title')}</h3>
        <textarea
          className="image-gen-prompt"
          placeholder={t('imageGen.promptPlaceholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
        />
        <div className="image-gen-actions">
          <button type="button" className="image-gen-btn" disabled={!prompt.trim()}>
            <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
            {t('imageGen.generate')}
          </button>
        </div>
      </div>

      <div className="image-gen-gallery-section">
        <h3 className="image-gen-section-title">{t('imageGen.results')}</h3>
        <div className="image-gen-gallery">
          {mockResults.map((item) => (
            <div key={item.id} className="image-gen-card">
              <div className="image-gen-card-preview">
                <span className="material-symbols-outlined" aria-hidden="true">image</span>
              </div>
              <span className="image-gen-card-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
