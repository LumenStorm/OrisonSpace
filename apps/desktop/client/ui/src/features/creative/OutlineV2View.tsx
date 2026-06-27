import type { z } from 'zod';
import type { outlineV2Schema } from '@orison/shared-contracts';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type OutlineV2 = z.infer<typeof outlineV2Schema>;

export function OutlineV2View() {
  const data = useAppStore((s) => s.creativeFields.outline) as OutlineV2 | undefined;
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  if (!data) {
    return <p className="creative-empty">{t('creative.empty')}</p>;
  }

  return (
    <div className="creative-field-body">
      {(data.story_type || data.writing_style) && (
        <div className="creative-field-row creative-field-row-inline">
          {data.story_type && (
            <span className="creative-inline-pair">
              <span className="creative-field-label">{t('outline.storyType')}</span>
              <span>{data.story_type}</span>
            </span>
          )}
          {data.writing_style && (
            <span className="creative-inline-pair">
              <span className="creative-field-label">{t('outline.writingStyle')}</span>
              <span>{data.writing_style}</span>
            </span>
          )}
        </div>
      )}
      {data.main_goal && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.mainGoal')}</span>
          <p>{data.main_goal}</p>
        </div>
      )}
      {data.central_conflict && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.centralConflict')}</span>
          <p>{data.central_conflict}</p>
        </div>
      )}
      {data.ending_direction && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.endingDirection')}</span>
          <p>{data.ending_direction}</p>
        </div>
      )}
      {data.phases.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.phases')}</span>
          <ol className="creative-list creative-list-ordered">
            {data.phases.map((p) => (
              <li key={p.id}>
                {p.title}
                {p.goal && <span className="creative-phase-goal"> — {p.goal}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {data.characters && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.characters')}</span>
          <p className="creative-field-value-lg">{data.characters}</p>
        </div>
      )}
      {data.growth_curve && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.growthCurve')}</span>
          <p className="creative-field-value-lg">{data.growth_curve}</p>
        </div>
      )}
      {data.pacing_curve_text && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.pacingCurve')}</span>
          <p className="creative-field-value-lg">{data.pacing_curve_text}</p>
        </div>
      )}
      {data.major_turning_points.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.turningPoints')}</span>
          <ul className="creative-list">
            {data.major_turning_points.map((tp, i) => <li key={i}>{tp}</li>)}
          </ul>
        </div>
      )}
      {data.constraints.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('outline.constraints')}</span>
          <div className="creative-tag-list-inline">
            {data.constraints.map((c, i) => <span key={i} className="asset-card-tag">{c}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
