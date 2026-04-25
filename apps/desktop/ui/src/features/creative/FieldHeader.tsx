import type { CreativeFieldKey } from '@orison/shared-contracts';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function FieldHeader({ field }: { field: CreativeFieldKey }) {
  const { fieldMetadata, toggleFieldLock, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      fieldMetadata: s.fieldMetadata,
      toggleFieldLock: s.toggleFieldLock,
      resolvedLocale: s.resolvedLocale,
    }))
  );

  const { t } = useI18n(resolvedLocale);
  const meta = fieldMetadata[field];
  const version = meta?.version ?? 0;
  const stale = meta?.stale ?? false;
  const locked = meta?.locked ?? false;

  return (
    <div className="field-header">
      <h3 className="field-header-title">{t(`creative.tabs.${field}`)}</h3>
      <span className="field-version-badge">v{version}</span>
      {stale && (
        <span className="field-stale-badge" title={t('creative.field.stale')}>
          <span className="material-symbols-outlined" aria-hidden="true">sync_problem</span>
        </span>
      )}
      <button
        type="button"
        className="field-lock-btn"
        title={locked ? t('creative.field.unlock') : t('creative.field.lock')}
        aria-label={locked ? t('creative.field.unlock') : t('creative.field.lock')}
        onClick={() => toggleFieldLock(field)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {locked ? 'lock' : 'lock_open'}
        </span>
      </button>
    </div>
  );
}
