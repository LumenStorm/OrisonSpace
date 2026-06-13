import { useEffect } from 'react';
import { detectIsMac } from '../components/WindowControls';

type ShortcutMap = Record<string, () => void>;

// Undo/redo must yield to the focused editor (textarea / Tiptap contenteditable):
// those surfaces own their own history. Intercepting these globally would
// swallow Ctrl+Z before the editor ever sees it.
const EDITOR_OWNED_KEYS = new Set(['z', 'Shift+z', 'y']);

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'TEXTAREA' || tag === 'INPUT' || el.isContentEditable;
}

export function useGlobalShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const isMac = detectIsMac();

    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      let key = '';
      if (e.shiftKey) key += 'Shift+';
      key += e.key.toLowerCase();

      // Let the active editor handle its own undo/redo natively.
      if (EDITOR_OWNED_KEYS.has(key) && isEditableTarget(e.target)) return;

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
