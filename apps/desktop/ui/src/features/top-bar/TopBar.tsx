import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { WindowControls, isMac } from '../../shared/components/WindowControls';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { AccountDialog } from '../../shared/components/AccountDialog';

type MenuItem =
  | { type: 'action'; label: string; shortcut?: string; handler: () => void; disabled?: boolean }
  | { type: 'separator' };

function MenuDropdown({
  items,
  onClose,
}: {
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  return (
    <div className="topbar-menu-dropdown" ref={ref}>
      {items.map((item, i) =>
        item.type === 'separator' ? (
          <div key={i} className="topbar-menu-separator" />
        ) : (
          <button
            key={i}
            type="button"
            className="topbar-menu-item"
            disabled={item.disabled}
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, handleUndo, handleRedo]);

  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const hasSavePath = !!currentProject?.path;
  const modKey = isMac ? '⌘' : 'Ctrl+';

  const fileItems: MenuItem[] = [
    { type: 'action', label: t('topbar.newProject'), handler: () => setShowNewDialog(true) },
    { type: 'action', label: t('topbar.openProject'), handler: handleOpen },
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
    { type: 'action', label: t('topbar.about'), handler: () => {} },
    { type: 'action', label: t('topbar.shortcuts'), handler: () => {} },
  ];

  const menus = [
    { key: 'file', label: t('topbar.menuFile'), items: fileItems },
    { key: 'edit', label: t('topbar.menuEdit'), items: editItems },
    { key: 'view', label: t('topbar.menuView'), items: viewItems },
    { key: 'help', label: t('topbar.menuHelp'), items: helpItems },
  ];

  return (
    <>
      <header className="workspace-topbar">
        {isMac && <div className="topbar-traffic-light-spacer" />}

        <div className="workspace-brand">{t('welcome.brand')}</div>

        {!minimal && (
          <nav className="topbar-menu" aria-label="Main Menu">
            {menus.map((menu) => (
              <div key={menu.key} className="topbar-menu-group">
                <button
                  type="button"
                  className={`topbar-menu-trigger${openMenu === menu.key ? ' is-open' : ''}`}
                  onClick={() => setOpenMenu(openMenu === menu.key ? null : menu.key)}
                  onMouseEnter={() => { if (openMenu) setOpenMenu(menu.key); }}
                >
                  {menu.label}
                </button>
                {openMenu === menu.key && (
                  <MenuDropdown items={menu.items} onClose={closeMenu} />
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
    </>
  );
}
