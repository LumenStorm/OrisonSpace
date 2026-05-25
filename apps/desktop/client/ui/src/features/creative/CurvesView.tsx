import type { z } from 'zod';
import type { growthCurveSchema, pacingCurveSchema, emotionCurveSchema, CreativeFieldKey } from '@orison/shared-contracts';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type GrowthCurve = z.infer<typeof growthCurveSchema>;
type PacingCurve = z.infer<typeof pacingCurveSchema>;
type EmotionCurve = z.infer<typeof emotionCurveSchema>;

export function CurvesView({ curveType }: { curveType: CreativeFieldKey }) {
  const data = useAppStore((s) => s.creativeFields[curveType]);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  if (!data) {
    return <p className="creative-empty">{t('creative.empty')}</p>;
  }

  if (curveType === 'growth_curve') {
    const curve = data as GrowthCurve;
    return (
      <div className="creative-field-body">
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.curves.character')}</span>
          <p>{curve.character_id}</p>
        </div>
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.curves.arc')}</span>
          <p>{curve.start_state} → {curve.end_state ?? '?'}</p>
        </div>
        {curve.turning_points.length > 0 && (
          <div className="creative-field-row">
            <span className="creative-field-label">{t('creative.curves.turningPoints')}</span>
            <ul className="creative-tag-list">
              {curve.turning_points.map((tp, i) => <li key={i}>{tp.turning_point}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (curveType === 'pacing_curve') {
    const curve = data as PacingCurve;
    return (
      <div className="creative-field-body">
        {curve.target_shape && (
          <div className="creative-field-row">
            <span className="creative-field-label">{t('creative.curves.targetShape')}</span>
            <p>{curve.target_shape}</p>
          </div>
        )}
        <div className="curve-bars">
          {curve.points.map((pt) => (
            <div key={pt.refId} className="curve-bar-row">
              <span className="curve-bar-label">{pt.refId}</span>
              <div className="curve-bar-track">
                <div className="curve-bar-fill" style={{ width: `${pt.intensity * 10}%` }} />
              </div>
              <span className="curve-bar-value">{pt.intensity}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // emotion_curve
  const curve = data as EmotionCurve;
  return (
    <div className="creative-field-body">
      {curve.points.map((pt) => (
        <div key={pt.refId} className="emotion-point">
          <strong>{pt.refId}</strong>
          <span className="emotion-primary">{pt.primaryEmotion}</span>
          {pt.valence != null && <span className="emotion-metric">V:{pt.valence.toFixed(1)}</span>}
          {pt.arousal != null && <span className="emotion-metric">A:{pt.arousal.toFixed(1)}</span>}
        </div>
      ))}
      {curve.catharsis_points.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.curves.catharsis')}</span>
          <ul className="creative-tag-list">
            {curve.catharsis_points.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
