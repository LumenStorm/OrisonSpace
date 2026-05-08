import type { ApiKeyEntry, ModelRef } from '@orison/shared-contracts';

type ProfileFieldProps = {
  keys: ApiKeyEntry[];
  selectedRef: ModelRef | null;
  onChange: (ref: ModelRef | null) => void;
  label: string;
  placeholder: string;
  capability?: 'text' | 'image' | 'video';
};

type FlatOption = {
  value: string;
  ref: ModelRef;
  label: string;
};

function flatten(keys: ApiKeyEntry[], capability?: string): FlatOption[] {
  const out: FlatOption[] = [];
  for (const key of keys) {
    for (const model of key.models) {
      if (!model.enabled) continue;
      if (capability && model.capability !== capability) continue;
      out.push({
        value: `${key.id}:${model.id}`,
        ref: { keyId: key.id, modelId: model.id },
        label: `${key.name} · ${model.alias}`,
      });
    }
  }
  return out;
}

export function ProfileField({
  keys,
  selectedRef,
  onChange,
  label,
  placeholder,
  capability,
}: ProfileFieldProps) {
  const options = flatten(keys, capability);
  const selectedKey = selectedRef ? `${selectedRef.keyId}:${selectedRef.modelId}` : '';
  return (
    <label className="inspector-field-item">
      <div className="inspector-label">{label}</div>
      <select
        className="inspector-select"
        value={selectedKey}
        onChange={(e) => {
          const next = options.find((opt) => opt.value === e.target.value);
          onChange(next ? next.ref : null);
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
