import {
  CUSTOM_SIZE_LIMITS,
  parseSizeString,
  validateCustomDimensions,
  type CustomSizeError,
} from '../../../shared/imageGen/schema';

const CUSTOM_SIZE_OPTION = 'custom';

type SizeFieldProps = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  value: string;
  customSize: boolean;
  options: readonly string[];
  supportsCustom: boolean;
  onPresetChange: (preset: string) => void;
  onCustomDimensionsChange: (width: number, height: number) => void;
};

/**
 * Size field with optional custom-dimensions mode (gpt-image-2). When the
 * dropdown selection is "custom...", two number inputs appear with live
 * validation against the OpenAI custom-dimension constraints.
 */
export function SizeField({
  t,
  value,
  customSize,
  options,
  supportsCustom,
  onPresetChange,
  onCustomDimensionsChange,
}: SizeFieldProps) {
  // Dropdown's selected value: "custom" when the custom UI is active,
  // otherwise the raw size string.
  const dropdownValue = customSize ? CUSTOM_SIZE_OPTION : value;

  // Parse the current size for the W/H inputs. When `value` is `auto` (a
  // preset, never custom), seed the inputs from the family default 1024x1024
  // so the user has a starting point.
  const parsed = parseSizeString(value);
  const inputWidth = parsed?.width ?? 1024;
  const inputHeight = parsed?.height ?? 1024;

  // Live validation only matters in custom mode. Presets bypass the rules
  // (4096x4096 etc. exceed the per-edge max but are allowed by the API).
  const validation = customSize
    ? validateCustomDimensions(inputWidth, inputHeight)
    : { valid: true, errors: [] as CustomSizeError[] };

  return (
    <label className="inspector-field-item">
      <div className="inspector-label">{t('imageGen.params.size')}</div>
      <select
        className="inspector-select"
        value={dropdownValue}
        onChange={(e) => onPresetChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        {supportsCustom && (
          <option value={CUSTOM_SIZE_OPTION}>
            {t('imageGen.params.sizeCustom')}
          </option>
        )}
      </select>

      {customSize && (
        <div className="image-gen-custom-size">
          <div className="image-gen-custom-size-row">
            <input
              type="number"
              className="image-gen-custom-size-input"
              aria-label={t('imageGen.params.customWidth')}
              min={CUSTOM_SIZE_LIMITS.edgeMin}
              max={CUSTOM_SIZE_LIMITS.edgeMax}
              step={CUSTOM_SIZE_LIMITS.edgeMultiple}
              value={inputWidth}
              onChange={(e) => onCustomDimensionsChange(Number(e.target.value), inputHeight)}
            />
            <span className="image-gen-custom-size-x" aria-hidden="true">×</span>
            <input
              type="number"
              className="image-gen-custom-size-input"
              aria-label={t('imageGen.params.customHeight')}
              min={CUSTOM_SIZE_LIMITS.edgeMin}
              max={CUSTOM_SIZE_LIMITS.edgeMax}
              step={CUSTOM_SIZE_LIMITS.edgeMultiple}
              value={inputHeight}
              onChange={(e) => onCustomDimensionsChange(inputWidth, Number(e.target.value))}
            />
          </div>
          <div
            className={`image-gen-custom-size-hint${validation.valid ? '' : ' is-invalid'}`}
            role={validation.valid ? undefined : 'alert'}
          >
            {validation.valid
              ? t('imageGen.params.customConstraints')
              : validation.errors.map((err) => t(`imageGen.params.customError.${err}`)).join(' · ')}
          </div>
        </div>
      )}
    </label>
  );
}

export { CUSTOM_SIZE_OPTION };
