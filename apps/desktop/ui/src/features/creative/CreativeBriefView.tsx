import type { z } from 'zod';
import type { creativeBriefSchema } from '@orison/shared-contracts';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type CreativeBrief = z.infer<typeof creativeBriefSchema>;

export function CreativeBriefView() {
  const data = useAppStore((s) => s.creativeFields.creative_brief) as CreativeBrief | undefined;
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  if (!data) {
    return <p className="creative-empty">{t('creative.empty')}</p>;
  }

  return (
    <div className="creative-field-body">
      <div className="creative-field-row">
        <span className="creative-field-label">{t('creative.brief.requirement')}</span>
        <p>{data.rawRequirement}</p>
      </div>
      {data.genre && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.brief.genre')}</span>
          <p>{data.genre}</p>
        </div>
      )}
      {data.theme && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.brief.theme')}</span>
          <p>{data.theme}</p>
        </div>
      )}
      {data.tone && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.brief.tone')}</span>
          <p>{data.tone}</p>
        </div>
      )}
      {data.audience && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.brief.audience')}</span>
          <p>{data.audience}</p>
        </div>
      )}
      {data.length && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.brief.length')}</span>
          <p>{data.length}</p>
        </div>
      )}
      {data.taboos.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.brief.taboos')}</span>
          <div className="creative-tag-list-inline">
            {data.taboos.map((t, i) => <span key={i} className="asset-card-tag">{t}</span>)}
          </div>
        </div>
      )}
      {data.userConstraints.length > 0 && (
        <div className="creative-field-row">
          <span className="creative-field-label">{t('creative.brief.userConstraints')}</span>
          <ul className="creative-tag-list">
            {data.userConstraints.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
