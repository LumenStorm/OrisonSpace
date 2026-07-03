import { useEffect, useRef, useState } from 'react';

export type FontOption = {
  /** CSS font-family value applied when picked. */
  value: string;
  /** Display name shown in the row. */
  label: string;
};

type FontPickerProps = {
  /** Current font-family value ('' = built-in default). */
  value: string;
  onChange: (value: string) => void;
  /** Selectable fonts (presets + imported), grouped by the caller. */
  options: FontOption[];
  /** Label for the built-in-default option. */
  defaultLabel: string;
  /** Chinese + latin sample rendered in each font for preview. */
  sampleText: string;
  /** Import-a-font action label; row hidden when omitted. */
  importLabel?: string;
  onImport?: () => void;
};

/**
 * Office-style font picker: a custom dropdown (the native <select> is OS-drawn
 * on Windows and ignores per-option font-family, so it can't preview). Each row
 * renders its label + a sample string in that very font.
 */
export function FontPicker({
  value,
  onChange,
  options,
  defaultLabel,
  sampleText,
  importLabel,
  onImport,
}: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const current = options.find((o) => o.value === value);

  return (
    <div className="font-picker" ref={ref}>
      <button
        type="button"
        className="form-field-input font-picker-trigger"
        style={value ? { fontFamily: value } : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-picker-current">{current?.label ?? defaultLabel}</span>
        <span className="material-symbols-outlined font-picker-caret" aria-hidden="true">
          expand_more
        </span>
      </button>

      {open && (
        <div className="font-picker-menu" role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={!value}
            className={`font-picker-option${!value ? ' is-active' : ''}`}
            onClick={() => pick('')}
          >
            <span className="font-picker-name">{defaultLabel}</span>
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              className={`font-picker-option${value === opt.value ? ' is-active' : ''}`}
              style={{ fontFamily: opt.value }}
              onClick={() => pick(opt.value)}
            >
              <span className="font-picker-name">{opt.label}</span>
              <span className="font-picker-sample">{sampleText}</span>
            </button>
          ))}
          {importLabel && onImport && (
            <button
              type="button"
              className="font-picker-import"
              onClick={() => {
                setOpen(false);
                onImport();
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                add
              </span>
              {importLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
