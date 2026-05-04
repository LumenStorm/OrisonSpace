type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  optionLabel?: (opt: string) => string;
  onChange: (next: string) => void;
};

export function SelectField({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: SelectFieldProps) {
  return (
    <label className="inspector-field-item">
      <div className="inspector-label">{label}</div>
      <select
        className="inspector-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel ? optionLabel(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}
