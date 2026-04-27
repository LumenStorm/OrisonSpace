import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { ForeshadowRegistry } from '@orison/shared-contracts';

export function ForeshadowRegistryView() {
  const { creativeFields, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      creativeFields: s.creativeFields,
      resolvedLocale: s.resolvedLocale,
    }))
  );

  const { t } = useI18n(resolvedLocale);
  const registry = creativeFields.foreshadow_registry as ForeshadowRegistry | undefined;
  const items = registry?.items ?? [];

  if (items.length === 0) {
    return <p className="creative-empty">{t('creative.foreshadow.empty')}</p>;
  }

  return (
    <ul className="creative-list" aria-label={t('creative.tabs.foreshadow_registry')}>
      {items.map((entry) => (
        <li key={entry.id} className="creative-list-item">
          <strong>{entry.title}</strong>
          <span className="creative-meta"> [{entry.status}]</span>
          {entry.category && <span className="creative-meta"> · {entry.category}</span>}
          <p className="creative-note">{entry.content}</p>
          {entry.hint_text && <p className="creative-note faded">hint: {entry.hint_text}</p>}
          {entry.notes && <p className="creative-note faded">{entry.notes}</p>}
        </li>
      ))}
    </ul>
  );
}
