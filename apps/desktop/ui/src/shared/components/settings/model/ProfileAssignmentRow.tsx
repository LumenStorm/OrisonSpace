import type { ModelCapability, ModelConfig, ModelProfile, ModelType, SlotAssignment } from '@orison/shared-contracts';

type Props = {
  profiles: ModelProfile[];
  selected: ModelConfig['selected'];
  onSelect: (type: ModelType, slot: SlotAssignment | null) => void;
  t: (key: string) => string;
};

const ASSIGNMENT_TYPES: Array<{ id: ModelType; labelKey: string; capability: ModelCapability }> = [
  { id: 'novel', labelKey: 'settings.novelModel', capability: 'text' },
  { id: 'image', labelKey: 'settings.imageModel', capability: 'image' },
  { id: 'video', labelKey: 'settings.videoModel', capability: 'video' },
];

type FlatOption = {
  value: string;
  slot: SlotAssignment;
  label: string;
};

function flattenAssignableModels(profiles: ModelProfile[], capability: ModelCapability): FlatOption[] {
  const out: FlatOption[] = [];
  for (const profile of profiles) {
    for (const model of profile.models) {
      if (!model.capabilities.includes(capability)) continue;
      out.push({
        value: `${profile.id}:${model.id}`,
        slot: { profileId: profile.id, modelId: model.id },
        label: `${profile.provider} · ${model.alias}`,
      });
    }
  }
  return out;
}

function selectedKey(slot: SlotAssignment | null): string {
  return slot ? `${slot.profileId}:${slot.modelId}` : '';
}

export function ProfileAssignmentRow({ profiles, selected, onSelect, t }: Props) {
  return (
    <section className="model-assignment-panel" aria-label={t('settings.modelType')}>
      <div className="model-assignment-header">
        <span className="sidebar-settings-label">{t('settings.modelType')}</span>
      </div>
      <div className="model-assignment-grid">
        {ASSIGNMENT_TYPES.map((type) => {
          const options = flattenAssignableModels(profiles, type.capability);
          const value = selectedKey(selected[type.id]);
          return (
            <label key={type.id} className="sidebar-settings-input-row">
              <span className="sidebar-settings-input-label">{t(type.labelKey)}</span>
              <select
                className="sidebar-settings-input"
                value={value}
                onChange={(event) => {
                  const next = options.find((opt) => opt.value === event.target.value);
                  onSelect(type.id, next ? next.slot : null);
                }}
              >
                <option value="">{t('settings.noUsage')}</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </section>
  );
}
