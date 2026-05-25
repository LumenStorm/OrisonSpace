import { useRef } from 'react';

type InlineInputProps = {
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function InlineInput({ defaultValue, onConfirm, onCancel }: InlineInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  const confirmOrCancel = () => {
    const value = ref.current?.value.trim();
    if (value && value !== defaultValue) onConfirm(value);
    else onCancel();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      confirmOrCancel();
    }
    if (event.key === 'Escape') onCancel();
  };

  return (
    <input
      ref={ref}
      className="ptree-inline-input"
      defaultValue={defaultValue}
      autoFocus
      onBlur={confirmOrCancel}
      onKeyDown={handleKeyDown}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
