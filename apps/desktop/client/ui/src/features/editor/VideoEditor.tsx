import { useMemo, useState } from 'react';
import type { ApiKeyEntry, DiscoveredModel, ModelRef } from '@orison/shared-contracts';
import { generateVideo } from '../../shared/api/generation';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function VideoEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const currentProject = useAppStore((s) => s.currentProject);
  const modelConfig = useAppStore((s) => s.modelConfig);
  const { t } = useI18n(resolvedLocale);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);

  const resolvedSlot = useMemo(
    () => resolveVideoSlot(modelConfig.keys),
    [modelConfig.keys],
  );

  const canGenerate = !!currentProject?.path && !!resolvedSlot && !!prompt.trim() && !loading;

  async function handleGenerate() {
    if (!resolvedSlot || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await generateVideo({
        ref: resolvedSlot.ref,
        request: {
          model: resolvedSlot.entry.id,
          prompt: prompt.trim(),
        },
      });
      setGeneratedCount(response.videos.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

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
        <button type="button" className="video-gen-btn" disabled={!canGenerate} onClick={() => void handleGenerate()}>
          <span className="material-symbols-outlined" aria-hidden="true">movie_edit</span>
          {loading ? t('video.generate') : t('video.generate')}
        </button>
        {error ? <p className="image-gen-error">{error}</p> : null}
        {!error && generatedCount > 0 ? (
          <p className="video-clip-label">{`Generated ${generatedCount} video(s)`}</p>
        ) : null}
      </div>

      <div className="video-clips-section">
        <div className="video-clips-header">
          <h3 className="video-clips-title">{t('video.clips')}</h3>
          <span className="overview-type-badge">Experimental</span>
        </div>
        <div className="video-clips-grid">
          <div className="assets-panel-empty">
            <span className="material-symbols-outlined" aria-hidden="true">movie</span>
            <p className="assets-panel-empty-hint">{t('video.noClips')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

type ResolvedSlot = {
  ref: ModelRef;
  key: ApiKeyEntry;
  entry: DiscoveredModel;
};

function resolveVideoSlot(keys: ApiKeyEntry[]): ResolvedSlot | null {
  for (const key of keys) {
    for (const model of key.models) {
      if (model.enabled && model.capability === 'video') {
        return { ref: { keyId: key.id, modelId: model.id }, key, entry: model };
      }
    }
  }
  return null;
}
