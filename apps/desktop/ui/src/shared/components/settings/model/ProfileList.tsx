import type { ModelConfig, ModelProfile } from '@orison/shared-contracts';
import { ProviderBadge } from './ProviderBadge';
import { computeUsedSlots, slotI18nKey, type UsedSlot } from './utils';

type Props = {
  profiles: ModelProfile[];
  selected: ModelConfig['selected'];
  activeProfileId: string | null;
  onSelectProfile: (profile: ModelProfile) => void;
  onAddProfile: () => void;
  t: (key: string) => string;
};

export function ProfileList({
  profiles,
  selected,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  t,
}: Props) {
  return (
    <section className="model-library-list" aria-label={t('settings.modelList')}>
      <div className="model-library-toolbar">
        <span className="sidebar-settings-label">{t('settings.modelList')}</span>
        <button
          type="button"
          className="settings-refresh-button"
          onClick={onAddProfile}
          aria-label={t('settings.addModel')}
          title={t('settings.addModel')}
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      <div className="model-profile-list">
        {profiles.map((profile) => {
          const used: UsedSlot[] = computeUsedSlots(profile.id, selected);
          const isActive = activeProfileId === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              className={`model-profile-row${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              onClick={() => onSelectProfile(profile)}
            >
              <div className="model-profile-row-head">
                <span className="model-profile-name">{profile.name}</span>
                <ProviderBadge provider={profile.provider} t={t} compact />
              </div>
              <span className="model-profile-meta">{profile.model || t('settings.modelSelectPlaceholder')}</span>
              {used.length > 0 ? (
                <div className="model-profile-used">
                  {used.map((slot) => (
                    <span key={slot} className={`model-used-chip model-used-chip-${slot}`}>
                      {t(slotI18nKey(slot))}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
