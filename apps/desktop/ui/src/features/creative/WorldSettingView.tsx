import type { z } from 'zod';
import type { worldSettingSchema } from '@orison/shared-contracts';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type WorldSetting = z.infer<typeof worldSettingSchema>;

export function WorldSettingView() {
  const data = useAppStore((s) => s.creativeFields.world_setting) as WorldSetting | undefined;
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  if (!data) {
    return <p className="creative-empty">{t('creative.empty')}</p>;
  }

  return (
    <div className="creative-field-body">
      {data.premise && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.worldSetting.premise')}</span>
          <p>{data.premise}</p>
        </div>
      )}
      {data.era && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.worldSetting.era')}</span>
          <p>{data.era}</p>
        </div>
      )}
      {data.locations.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.worldSetting.locations')}</span>
          <ul className="creative-tag-list">
            {data.locations.map((loc) => (
              <li key={loc.id}>{loc.name}{loc.description ? ` — ${loc.description}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
      {data.rules.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.worldSetting.rules')}</span>
          <ul className="creative-tag-list">
            {data.rules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {data.tone_rules.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.worldSetting.toneRules')}</span>
          <ul className="creative-tag-list">
            {data.tone_rules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
