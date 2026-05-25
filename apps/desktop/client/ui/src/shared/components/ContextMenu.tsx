import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type ContextMenuItem =
  | { type: 'item'; label: string; icon?: string; disabled?: boolean; danger?: boolean; onClick: () => void }
  | { type: 'separator' };

type ContextMenuProps = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) ref.current.style.left = `${vw - rect.width - 4}px`;
    if (rect.bottom > vh) ref.current.style.top = `${vh - rect.height - 4}px`;
  }, [x, y]);

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.type !== 'item' || item.disabled) return;
      item.onClick();
      onClose();
    },
    [onClose],
  );

  return createPortal(
    <div className="ctx-menu" ref={ref} style={{ left: x, top: y }} role="menu">
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={`sep-${i}`} className="ctx-menu-separator" role="separator" />;
        }
        return (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role="menuitem"
            className={`ctx-menu-item${item.danger ? ' ctx-menu-item-danger' : ''}${item.disabled ? ' ctx-menu-item-disabled' : ''}`}
            disabled={item.disabled}
            onClick={() => handleItemClick(item)}
          >
            {item.icon && (
              <span className="material-symbols-outlined ctx-menu-item-icon" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className="ctx-menu-item-label">{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
