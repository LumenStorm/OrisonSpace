import { useEffect, useRef, useState } from 'react';

export type MenuItem =
  | { type: 'action'; label: string; shortcut?: string; handler: () => void; disabled?: boolean }
  | { type: 'separator' };

type MenuDropdownProps = {
  items: MenuItem[];
  onClose: () => void;
  onPrevMenu?: () => void;
  onNextMenu?: () => void;
};

export function MenuDropdown({ items, onClose, onPrevMenu, onNextMenu }: MenuDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const actionIndices = items
    .map((item, index) => (item.type === 'action' && !item.disabled ? index : -1))
    .filter((index) => index !== -1);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const pos = actionIndices.indexOf(focusedIndex);
        setFocusedIndex(pos < actionIndices.length - 1 ? actionIndices[pos + 1] : actionIndices[0]);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const pos = actionIndices.indexOf(focusedIndex);
        setFocusedIndex(pos > 0 ? actionIndices[pos - 1] : actionIndices[actionIndices.length - 1]);
        break;
      }
      case 'ArrowLeft':
        event.preventDefault();
        onPrevMenu?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        onNextMenu?.();
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const item = items[focusedIndex];
        if (item?.type === 'action' && !item.disabled) {
          item.handler();
          onClose();
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <div
      className="topbar-menu-dropdown"
      ref={ref}
      role="menu"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) =>
        item.type === 'separator' ? (
          <div key={index} className="topbar-menu-separator" role="separator" />
        ) : (
          <button
            key={index}
            type="button"
            className={`topbar-menu-item${index === focusedIndex ? ' is-focused' : ''}`}
            role="menuitem"
            disabled={item.disabled}
            tabIndex={-1}
            onMouseEnter={() => setFocusedIndex(index)}
            onMouseLeave={() => setFocusedIndex(-1)}
            onClick={() => {
              item.handler();
              onClose();
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="topbar-menu-shortcut">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
