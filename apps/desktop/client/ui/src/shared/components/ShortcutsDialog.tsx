import { useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { detectIsMac } from './WindowControls';

type Props = { onClose: () => void };

const isMac = detectIsMac();
const mod = isMac ? '⌘' : 'Ctrl+';

const sections = [
  {
    titleKey: 'topbar.menuFile',
    items: [
      { key: 'topbar.newProject', shortcut: `${mod}N` },
      { key: 'topbar.openProject', shortcut: `${mod}O` },
      { key: 'topbar.save', shortcut: `${mod}S` },
    ],
  },
  {
    titleKey: 'topbar.menuEdit',
    items: [
      { key: 'topbar.undo', shortcut: `${mod}Z` },
      { key: 'topbar.redo', shortcut: isMac ? '⌘⇧Z' : 'Ctrl+Shift+Z' },
      { key: 'shortcuts.find', shortcut: `${mod}F` },
      { key: 'shortcuts.replace', shortcut: `${mod}H` },
    ],
  },
  {
    titleKey: 'topbar.menuView',
    items: [
      { key: 'topbar.toggleProjectTree', shortcut: `${mod}B` },
      { key: 'topbar.toggleBottomPanel', shortcut: `${mod}J` },
      { key: 'shortcuts.commandPalette', shortcut: isMac ? '⌘⇧P' : 'Ctrl+Shift+P' },
      { key: 'shortcuts.quickOpen', shortcut: `${mod}P` },
    ],
  },
  {
    titleKey: 'shortcuts.tabs',
    items: [
      { key: 'fileEditor.close', shortcut: `${mod}W` },
      { key: 'fileEditor.reopenClosed', shortcut: isMac ? '⌘⇧T' : 'Ctrl+Shift+T' },
      { key: 'shortcuts.nextTab', shortcut: `${mod}Tab` },
      { key: 'shortcuts.prevTab', shortcut: isMac ? '⌘⇧Tab' : 'Ctrl+Shift+Tab' },
    ],
  },
];

export function ShortcutsDialog({ onClose }: Props) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);

  return (
    <div className="topbar-new-dialog-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="settings-dialog" ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title">{t('topbar.shortcuts')}</h2>
          <button type="button" className="settings-dialog-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-dialog-body shortcuts-dialog-body">
          {sections.map((sec) => (
            <div key={sec.titleKey} className="shortcuts-section">
              <h3 className="shortcuts-section-title">{t(sec.titleKey)}</h3>
              <dl className="shortcuts-list">
                {sec.items.map((item) => (
                  <div key={item.key} className="shortcuts-row">
                    <dt>{t(item.key)}</dt>
                    <dd><kbd>{item.shortcut}</kbd></dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
