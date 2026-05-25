import { useEffect } from 'react';
import { detectIsMac } from '../components/WindowControls';

type ShortcutMap = Record<string, () => void>;

export function useGlobalShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const isMac = detectIsMac();

    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      let key = '';
      if (e.shiftKey) key += 'Shift+';
      key += e.key.toLowerCase();

      const action = shortcuts[key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
