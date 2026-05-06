import type { ModelProfile, SlotAssignment } from '@orison/shared-contracts';

type ProfileFieldProps = {
  profiles: ModelProfile[];
  selectedSlot: SlotAssignment | null;
  onChange: (slot: SlotAssignment | null) => void;
  label: string;
  placeholder: string;
};

type FlatOption = {
  value: string;
  slot: SlotAssignment;
  label: string;
};

function flatten(profiles: ModelProfile[]): FlatOption[] {
  const out: FlatOption[] = [];
  for (const profile of profiles) {
    for (const model of profile.models) {
      out.push({
        value: `${profile.id}:${model.id}`,
        slot: { profileId: profile.id, modelId: model.id },
        label: `${profile.provider} · ${model.alias}`,
      });
    }
  }
  return out;
}

export function ProfileField({
  profiles,
  selectedSlot,
  onChange,
  label,
  placeholder,
}: ProfileFieldProps) {
  const options = flatten(profiles);
  const selectedKey = selectedSlot ? `${selectedSlot.profileId}:${selectedSlot.modelId}` : '';
  return (
    <label className="inspector-field-item">
      <div className="inspector-label">{label}</div>
      <select
        className="inspector-select"
        value={selectedKey}
        onChange={(e) => {
          const next = options.find((opt) => opt.value === e.target.value);
          onChange(next ? next.slot : null);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}
