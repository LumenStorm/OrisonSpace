import { useMemo, useState } from 'react';
import type { ModelEntry, ModelProfile, SlotAssignment } from '@orison/shared-contracts';
import { generateVideo } from '../../shared/api/generation';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

const mockClips = [
  { id: 'clip-001', label: 'Shot 01 — Establishing' },
  { id: 'clip-002', label: 'Shot 02 — Mid shot' },
  { id: 'clip-003', label: 'Shot 03 — Close-up' },
];

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
    () => resolveVideoSlot(modelConfig.profiles, modelConfig.selected.video),
    [modelConfig.profiles, modelConfig.selected.video],
  );

  const canGenerate = !!currentProject?.path && !!resolvedSlot && !!prompt.trim() && !loading;

  async function handleGenerate() {
    if (!resolvedSlot || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await generateVideo({
        slot: resolvedSlot.slot,
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

type ResolvedSlot = {
  slot: SlotAssignment;
  profile: ModelProfile;
  entry: ModelEntry;
};

function resolveVideoSlot(profiles: ModelProfile[], slot: SlotAssignment | null): ResolvedSlot | null {
  if (!slot) return null;
  const profile = profiles.find((p) => p.id === slot.profileId);
  if (!profile) return null;
  const entry = profile.models.find((m) => m.id === slot.modelId);
  if (!entry) return null;
  return { slot, profile, entry };
}
