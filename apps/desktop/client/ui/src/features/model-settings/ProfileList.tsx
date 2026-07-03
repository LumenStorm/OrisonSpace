import type { ApiKeyEntry } from '@orison/shared-contracts';

type Props = {
  keys: ApiKeyEntry[];
  activeKeyId: string | null;
  onSelectKey: (key: ApiKeyEntry) => void;
  onAddKey: () => void;
  t: (key: string) => string;
};

export function ProfileList({
  keys,
  activeKeyId,
  onSelectKey,
  onAddKey,
  t,
}: Props) {
  return (
    <section className="model-library-list" aria-label={t('settings.modelList')}>
      <div className="model-library-toolbar">
        <span className="form-field-label">{t('settings.modelList')}</span>
        <button
          type="button"
          className="settings-refresh-button"
          onClick={onAddKey}
          aria-label={t('settings.addModel')}
          title={t('settings.addModel')}
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      <div className="model-profile-list">
        {keys.map((key) => {
          const isActive = activeKeyId === key.id;
          const enabledCount = key.models.filter((m) => m.enabled).length;
          const summary = key.models
            .filter((m) => m.enabled)
            .slice(0, 3)
            .map((m) => m.alias)
            .join(', ');
          return (
            <button
              key={key.id}
              type="button"
              className={`model-profile-row${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              onClick={() => onSelectKey(key)}
            >
              <div className="model-profile-row-head">
                <span className="model-profile-name">{key.name}</span>
                <span className="model-profile-count">{enabledCount}</span>
              </div>
              <span className="model-profile-meta">
                {summary || t('settings.modelSelectPlaceholder')}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
