import { useState } from 'react';

type Props = {
  title: string;
  defaultOpen?: boolean;
  onAdd?: () => void;
  children: React.ReactNode;
};

export function OutlineToggle({ title, defaultOpen = false, onAdd, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`outline-toggle${open ? ' is-open' : ''}`}>
      <div className="outline-toggle-header" onClick={() => setOpen((v) => !v)}>
        <span className="outline-toggle-chevron material-symbols-outlined">
          chevron_right
        </span>
        <span className="outline-toggle-title">{title}</span>
        {onAdd && (
          <button
            type="button"
            className="outline-toggle-action"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        )}
      </div>
      {open && (
        <div className="outline-toggle-body">
          {children}
        </div>
      )}
    </div>
  );
}
