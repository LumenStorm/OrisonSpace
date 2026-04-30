import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { WindowControls, detectIsMac } from '../../shared/components/WindowControls';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { AccountDialog } from '../../shared/components/AccountDialog';
import { AboutDialog } from '../../shared/components/AboutDialog';
import { useGlobalShortcuts } from '../../shared/hooks/useGlobalShortcuts';

type MenuItem =
  | { type: 'action'; label: string; shortcut?: string; handler: () => void; disabled?: boolean }
  | { type: 'separator' };

function MenuDropdown({
  items,
  onClose,
  onPrevMenu,
  onNextMenu,
}: {
  items: MenuItem[];
  onClose: () => void;
  onPrevMenu?: () => void;
  onNextMenu?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const actionIndices = items
    .map((item, i) => (item.type === 'action' && !item.disabled ? i : -1))
    .filter((i) => i !== -1);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const pos = actionIndices.indexOf(focusedIndex);
        const next = pos < actionIndices.length - 1 ? actionIndices[pos + 1] : actionIndices[0];
        setFocusedIndex(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const pos = actionIndices.indexOf(focusedIndex);
        const prev = pos > 0 ? actionIndices[pos - 1] : actionIndices[actionIndices.length - 1];
        setFocusedIndex(prev);
        break;
      }
      case 'ArrowLeft':
        e.preventDefault();
        onPrevMenu?.();
        break;
      case 'ArrowRight':
        e.preventDefault();
        onNextMenu?.();
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const item = items[focusedIndex];
        if (item?.type === 'action' && !item.disabled) {
          item.handler();
          onClose();
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
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
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <div key={i} className="topbar-menu-separator" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            className={`topbar-menu-item${i === focusedIndex ? ' is-focused' : ''}`}
            role="menuitem"
            disabled={item.disabled}
            tabIndex={-1}
            onMouseEnter={() => setFocusedIndex(i)}
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

export function TopBar({ minimal = false }: { minimal?: boolean }) {
  const isMac = detectIsMac();
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const openProject = useAppStore((s) => s.openProject);
  const closeProject = useAppStore((s) => s.closeProject);
  const currentProject = useAppStore((s) => s.currentProject);
  const saveProject = useAppStore((s) => s.saveProject);
  const saveChaptersToProject = useAppStore((s) => s.saveChaptersToProject);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const undoLen = useAppStore((s) => s.undoStack.length);
  const redoLen = useAppStore((s) => s.redoStack.length);
  const toggleProjectTree = useAppStore((s) => s.toggleProjectTree);
  const toggleBottomPanel = useAppStore((s) => s.toggleBottomPanel);
  const { t } = useI18n(resolvedLocale);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleOpen = async () => {
    const dir = await window.orisonDesktop?.pickProjectDirectory();
    if (!dir) return;
    const meta = await window.orisonDesktop?.loadProjectMeta(dir);
    if (meta) {
      openProject({
        name: (meta.name as string) || dir.split(/[\\/]/).pop() || 'Project',
        path: dir,
        type: (meta.type as 'novel' | 'script') || 'script',
        coverImage: (meta.coverImage as string) || undefined,
      });
    } else {
      openProject({ name: dir.split(/[\\/]/).pop() || 'Project', path: dir, type: 'script' });
    }
  };

  const handleSave = useCallback(async () => {
    await saveProject();
    await saveChaptersToProject();
  }, [saveProject, saveChaptersToProject]);

  const handleUndo = useCallback(() => undo(), [undo]);
  const handleRedo = useCallback(() => redo(), [redo]);

  const shortcuts = useMemo(() => ({
    's': handleSave,
    'z': handleUndo,
    'Shift+z': handleRedo,
    'y': handleRedo,
    'n': () => setShowNewDialog(true),
    'o': () => handleOpen(),
  }), [handleSave, handleUndo, handleRedo, handleOpen]);

  useGlobalShortcuts(shortcuts);

  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const hasSavePath = !!currentProject?.path;
  const modKey = isMac ? '⌘' : 'Ctrl+';

  const fileItems: MenuItem[] = [
    { type: 'action', label: t('topbar.newProject'), shortcut: `${modKey}N`, handler: () => setShowNewDialog(true) },
    { type: 'action', label: t('topbar.openProject'), shortcut: `${modKey}O`, handler: handleOpen },
    { type: 'action', label: t('topbar.save'), shortcut: `${modKey}S`, handler: handleSave, disabled: !hasSavePath },
    { type: 'action', label: t('topbar.export'), handler: () => {}, disabled: true },
    { type: 'separator' },
    ...(currentProject
      ? [{ type: 'action' as const, label: t('topbar.backToProjects'), handler: closeProject }]
      : []),
  ];

  const editItems: MenuItem[] = [
    { type: 'action', label: t('topbar.undo'), shortcut: `${modKey}Z`, handler: handleUndo, disabled: undoLen === 0 },
    { type: 'action', label: t('topbar.redo'), shortcut: isMac ? '⌘⇧Z' : 'Ctrl+Shift+Z', handler: handleRedo, disabled: redoLen === 0 },
  ];

  const viewItems: MenuItem[] = [
    { type: 'action', label: t('topbar.toggleProjectTree'), handler: toggleProjectTree },
    { type: 'action', label: t('topbar.toggleBottomPanel'), handler: toggleBottomPanel },
    { type: 'separator' },
    { type: 'action', label: t('topbar.settings'), handler: () => setShowSettings(true) },
    { type: 'action', label: t('topbar.account'), handler: () => setShowAccount(true) },
  ];

  const helpItems: MenuItem[] = [
    { type: 'action', label: t('topbar.about'), handler: () => setShowAbout(true) },
    { type: 'action', label: t('topbar.shortcuts'), handler: () => {} },
  ];

  const menus = [
    { key: 'file', label: t('topbar.menuFile'), items: fileItems },
    { key: 'edit', label: t('topbar.menuEdit'), items: editItems },
    { key: 'view', label: t('topbar.menuView'), items: viewItems },
    { key: 'help', label: t('topbar.menuHelp'), items: helpItems },
  ];

  const menuKeys = menus.map((m) => m.key);
  const switchMenu = useCallback((dir: -1 | 1) => {
    setOpenMenu((cur) => {
      if (!cur) return null;
      const idx = menuKeys.indexOf(cur);
      return menuKeys[(idx + dir + menuKeys.length) % menuKeys.length];
    });
  }, [menuKeys]);

  return (
    <>
      <header className="workspace-topbar">
        {isMac && <div className="topbar-traffic-light-spacer" />}

        <div className="workspace-brand">{t('welcome.brand')}</div>

        {!minimal && (
          <nav className="topbar-menu" aria-label="Main Menu" role="menubar">
            {menus.map((menu) => (
              <div key={menu.key} className="topbar-menu-group">
                <button
                  type="button"
                  className={`topbar-menu-trigger${openMenu === menu.key ? ' is-open' : ''}`}
                  role="menuitem"
                  aria-haspopup="true"
                  aria-expanded={openMenu === menu.key}
                  onClick={() => setOpenMenu(openMenu === menu.key ? null : menu.key)}
                  onMouseEnter={() => { if (openMenu) setOpenMenu(menu.key); }}
                >
                  {menu.label}
                </button>
                {openMenu === menu.key && (
                  <MenuDropdown
                    items={menu.items}
                    onClose={closeMenu}
                    onPrevMenu={() => switchMenu(-1)}
                    onNextMenu={() => switchMenu(1)}
                  />
                )}
              </div>
            ))}
          </nav>
        )}

        <WindowControls />
      </header>

      {showNewDialog && <NewProjectDialog onClose={() => setShowNewDialog(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showAccount && <AccountDialog onClose={() => setShowAccount(false)} />}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </>
  );
}
