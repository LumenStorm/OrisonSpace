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
      {data.title && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.title')}</span>
          <p className="creative-field-value-lg">{data.title}</p>
        </div>
      )}
      {data.logline && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.logline')}</span>
          <p>{data.logline}</p>
        </div>
      )}
      {data.genre && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.genre')}</span>
          <p>{data.genre}</p>
        </div>
      )}
      {data.theme && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.theme')}</span>
          <p>{data.theme}</p>
        </div>
      )}
      {data.central_conflict && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.centralConflict')}</span>
          <p>{data.central_conflict}</p>
        </div>
      )}
      {data.synopsis && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.synopsis')}</span>
          <p className="creative-field-value-lg">{data.synopsis}</p>
        </div>
      )}
      {data.ending_direction && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.endingDirection')}</span>
          <p>{data.ending_direction}</p>
        </div>
      )}
      {data.major_turning_points.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.turningPoints')}</span>
          <ul className="creative-list">
            {data.major_turning_points.map((tp, i) => <li key={i}>{tp}</li>)}
          </ul>
        </div>
      )}
      {data.constraints.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.constraints')}</span>
          <div className="creative-tag-list-inline">
            {data.constraints.map((c, i) => <span key={i} className="asset-card-tag">{c}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
