import type { ModelCapability, ModelConfig, ModelProfile, ModelType } from '@orison/shared-contracts';

type Props = {
  profiles: ModelProfile[];
  selected: ModelConfig['selected'];
  onSelect: (type: ModelType, profileId: string | null) => void;
  t: (key: string) => string;
};

const ASSIGNMENT_TYPES: Array<{ id: ModelType; labelKey: string; capability: ModelCapability }> = [
  { id: 'novel', labelKey: 'settings.novelModel', capability: 'text' },
  { id: 'image', labelKey: 'settings.imageModel', capability: 'image' },
  { id: 'video', labelKey: 'settings.videoModel', capability: 'video' },
];

export function ProfileAssignmentRow({ profiles, selected, onSelect, t }: Props) {
  return (
    <section className="model-assignment-panel" aria-label={t('settings.modelType')}>
      <div className="model-assignment-header">
        <span className="sidebar-settings-label">{t('settings.modelType')}</span>
      </div>
      <div className="model-assignment-grid">
        {ASSIGNMENT_TYPES.map((type) => {
          const compatible = profiles.filter((profile) => profile.capabilities.includes(type.capability));
          const value = selected[type.id] ?? '';
          return (
            <label key={type.id} className="sidebar-settings-input-row">
              <span className="sidebar-settings-input-label">{t(type.labelKey)}</span>
              <select
                className="sidebar-settings-input"
                value={value}
                onChange={(event) => onSelect(type.id, event.target.value || null)}
              >
                <option value="">{t('settings.noUsage')}</option>
                {compatible.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </section>
  );
}
