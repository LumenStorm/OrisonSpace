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
      {data.central_conflict && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.centralConflict')}</span>
          <p>{data.central_conflict}</p>
        </div>
      )}
      {data.acts.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.acts')}</span>
          <div className="outline-acts-list">
            {data.acts.map((act) => (
              <div key={act.id} className="outline-act-item">
                <strong>{act.title}</strong>
                {act.goal && <p>{act.goal}</p>}
                {act.conflict && <p className="creative-field-secondary">{act.conflict}</p>}
                {act.turning_point && <p className="creative-field-secondary">{act.turning_point}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.ending_direction && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.outline.endingDirection')}</span>
          <p>{data.ending_direction}</p>
        </div>
      )}
    </div>
  );
}
