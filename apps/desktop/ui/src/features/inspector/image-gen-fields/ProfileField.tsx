import type { ModelProfile } from '@orison/shared-contracts';

type ProfileFieldProps = {
  profiles: ModelProfile[];
  selectedId: string;
  onChange: (id: string) => void;
  label: string;
  placeholder: string;
};

export function ProfileField({
  profiles,
  selectedId,
  onChange,
  label,
  placeholder,
}: ProfileFieldProps) {
  return (
    <label className="inspector-field-item">
      <div className="inspector-label">{label}</div>
      <select
        className="inspector-select"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name} / {profile.model}
          </option>
        ))}
      </select>
    </label>
  );
}
