import type { z } from 'zod';
import type { episodeOutlinesSchema } from '@orison/shared-contracts';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type EpisodeOutline = z.infer<typeof episodeOutlinesSchema>[number];

export function EpisodeOutlinesList() {
  const data = useAppStore((s) => s.creativeFields.episode_outlines) as EpisodeOutline[] | undefined;
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  if (!data || data.length === 0) {
    return <p className="creative-empty">{t('creative.empty')}</p>;
  }

  const sorted = [...data].sort((a, b) => a.index - b.index);

  return (
    <div className="creative-field-body">
      {sorted.map((ep) => (
        <div key={ep.id} className="episode-item">
          <div className="episode-item-header">
            <span className="episode-index">#{ep.index + 1}</span>
            <strong>{ep.title}</strong>
            <span className={`episode-status episode-status--${ep.status}`}>{ep.status}</span>
          </div>
          {ep.purpose && <p className="creative-field-secondary">{ep.purpose}</p>}
          {ep.summary && <p>{ep.summary}</p>}
          {ep.emotional_beats.length > 0 && (
            <div className="episode-beats">
              {ep.emotional_beats.map((beat, i) => (
                <span key={i} className="episode-beat-tag">{beat}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
