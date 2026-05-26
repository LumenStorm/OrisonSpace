import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { WindowControls, detectIsMac } from '../../shared/components/WindowControls';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { AboutDialog } from '../../shared/components/AboutDialog';
import { UpdateAvailableDialog } from '../../shared/components/UpdateAvailableDialog';
import { ShortcutsDialog } from '../../shared/components/ShortcutsDialog';
import { useGlobalShortcuts } from '../../shared/hooks/useGlobalShortcuts';
import { useOpenProject } from '../../shared/hooks/useOpenProject';
import { MenuDropdown, type MenuItem } from './MenuDropdown';

export function TopBar() {
  const isMac = detectIsMac();
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const closeProject = useAppStore((s) => s.closeProject);
  const currentProject = useAppStore((s) => s.currentProject);
  const saveProject = useAppStore((s) => s.saveProject);
  const saveChaptersToProject = useAppStore((s) => s.saveChaptersToProject);
  const saveAllOpenFiles = useAppStore((s) => s.saveAllOpenFiles);
  const showToast = useAppStore((s) => s.showToast);
  const requestCloseFile = useAppStore((s) => s.requestCloseFile);
  const reopenLastClosedFile = useAppStore((s) => s.reopenLastClosedFile);
  const cycleActiveFile = useAppStore((s) => s.cycleActiveFile);
  const checkForUpdate = useAppStore((s) => s.checkForUpdate);
  const appVersion = useAppStore((s) => s.appVersion);
  const openPalette = useAppStore((s) => s.openPalette);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const undoLen = useAppStore((s) => s.undoStack.length);
  const redoLen = useAppStore((s) => s.redoStack.length);
  const toggleProjectTree = useAppStore((s) => s.toggleProjectTree);
  const toggleBottomPanel = useAppStore((s) => s.toggleBottomPanel);
  const { t } = useI18n(resolvedLocale);
  const handleOpen = useOpenProject();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    await saveProject();
    await saveChaptersToProject();
    await saveAllOpenFiles();
    showToast(t('topbar.saved') || '已保存');
  }, [saveProject, saveChaptersToProject, saveAllOpenFiles, showToast, t]);

  const handleUndo = useCallback(() => undo(), [undo]);
  const handleRedo = useCallback(() => redo(), [redo]);

  const shortcuts = useMemo(() => ({
    's': handleSave,
    'z': handleUndo,
    'Shift+z': handleRedo,
    'y': handleRedo,
    'n': () => setShowNewDialog(true),
    'o': () => handleOpen(),
    'w': () => {
      const active = useAppStore.getState().activeFilePath;
      if (active) requestCloseFile(active);
    },
    'Shift+t': () => { void reopenLastClosedFile(); },
    'tab': () => cycleActiveFile(1),
    'Shift+tab': () => cycleActiveFile(-1),
    'p': () => openPalette('files'),
    'Shift+p': () => openPalette('commands'),
    'b': toggleProjectTree,
    'j': toggleBottomPanel,
  }), [handleSave, handleUndo, handleRedo, handleOpen, requestCloseFile, reopenLastClosedFile, cycleActiveFile, openPalette, toggleProjectTree, toggleBottomPanel]);

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
    { type: 'action', label: t('topbar.toggleProjectTree'), shortcut: `${modKey}B`, handler: toggleProjectTree },
    { type: 'action', label: t('topbar.toggleBottomPanel'), shortcut: `${modKey}J`, handler: toggleBottomPanel },
    { type: 'separator' },
    { type: 'action', label: t('topbar.settings'), handler: () => setShowSettings(true) },
  ];

  const helpItems: MenuItem[] = [
    { type: 'action', label: t('topbar.checkForUpdate'), handler: () => { void checkForUpdate(); } },
    { type: 'separator' },
    { type: 'action', label: t('topbar.about'), handler: () => setShowAbout(true) },
    { type: 'action', label: t('topbar.shortcuts'), handler: () => setShowShortcuts(true) },
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

        <div className="workspace-brand">
          {t('welcome.brand')}
          {appVersion && <span className="workspace-brand-version">v{appVersion}</span>}
        </div>

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

        <WindowControls />
      </header>

      {showNewDialog && <NewProjectDialog onClose={() => setShowNewDialog(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      <UpdateAvailableDialog />
    </>
  );
}
