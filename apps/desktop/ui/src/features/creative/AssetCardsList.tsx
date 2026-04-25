import type { z } from 'zod';
import type { assetCardsSchema } from '@orison/shared-contracts';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type AssetCard = z.infer<typeof assetCardsSchema>[number];

export function AssetCardsList() {
  const data = useAppStore((s) => s.creativeFields.asset_cards) as AssetCard[] | undefined;
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  if (!data || data.length === 0) {
    return <p className="creative-empty">{t('creative.empty')}</p>;
  }

  const grouped = new Map<string, AssetCard[]>();
  for (const card of data) {
    const list = grouped.get(card.type) ?? [];
    list.push(card);
    grouped.set(card.type, list);
  }

  return (
    <div className="creative-field-body">
      {[...grouped.entries()].map(([type, cards]) => (
        <div key={type} className="asset-card-group">
          <h4 className="asset-card-group-title">{type}</h4>
          <div className="asset-card-grid">
            {cards.map((card) => (
              <article key={card.id} className="asset-card">
                <div className="asset-card-header">
                  <span className="asset-card-type-badge">{card.type}</span>
                  <span className="asset-card-name">{card.name}</span>
                </div>
                {card.summary && <p className="asset-card-summary">{card.summary}</p>}
                {card.tags.length > 0 && (
                  <div className="asset-card-tags">
                    {card.tags.map((tag) => (
                      <span key={tag} className="asset-card-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
