import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useToastStore } from '../../shared/store/toastStore';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../../shared/i18n/useI18n';
import { normalizePath } from '../../shared/utils/paths';
import { NewProjectDialog } from '../../shared/components/NewProjectDialog';
import { WindowControls, detectIsMac } from '../../shared/components/WindowControls';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { AboutDialog } from '../../shared/components/AboutDialog';
import { UpdateAvailableDialog } from '../../shared/components/UpdateAvailableDialog';
import { ShortcutsDialog } from '../../shared/components/ShortcutsDialog';
import { ExportDialog } from '../../shared/components/ExportDialog';
import { useGlobalShortcuts } from '../../shared/hooks/useGlobalShortcuts';
import { useOpenProject } from '../../shared/hooks/useOpenProject';
import { MenuDropdown, type MenuItem } from './MenuDropdown';
import { NotificationCenter } from '../notifications/NotificationCenter';

export function TopBar() {
  const isMac = detectIsMac();
  const {
    resolvedLocale, closeProject, currentProject, saveProject, saveChaptersToProject,
    saveAllOpenFiles, requestCloseFile, reopenLastClosedFile, cycleActiveFile,
    checkForUpdate, appVersion, openPalette, undo, redo, toggleProjectTree, toggleBottomPanel,
    toggleAgentPanel, toggleNotificationPanel, setTheme, closeAllFiles,
    splitDirection, setSplit, showMinimap, toggleMinimap, refreshWordCount, openFile,
  } = useAppStore(useShallow((s) => ({
    resolvedLocale: s.resolvedLocale,
    closeProject: s.closeProject,
    currentProject: s.currentProject,
    saveProject: s.saveProject,
    saveChaptersToProject: s.saveChaptersToProject,
    saveAllOpenFiles: s.saveAllOpenFiles,
    requestCloseFile: s.requestCloseFile,
    reopenLastClosedFile: s.reopenLastClosedFile,
    cycleActiveFile: s.cycleActiveFile,
    checkForUpdate: s.checkForUpdate,
    appVersion: s.appVersion,
    openPalette: s.openPalette,
    undo: s.undo,
    redo: s.redo,
    toggleProjectTree: s.toggleProjectTree,
    toggleBottomPanel: s.toggleBottomPanel,
    toggleAgentPanel: s.toggleAgentPanel,
    toggleNotificationPanel: s.toggleNotificationPanel,
    setTheme: s.setTheme,
    closeAllFiles: s.closeAllFiles,
    splitDirection: s.splitDirection,
    setSplit: s.setSplit,
    showMinimap: s.showMinimap,
    toggleMinimap: s.toggleMinimap,
    refreshWordCount: s.refreshWordCount,
    openFile: s.openFile,
  })));
  const showToast = useToastStore((s) => s.showToast);
  const undoLen = useAppStore((s) => s.undoStack.length);
  const redoLen = useAppStore((s) => s.redoStack.length);
  const { t } = useI18n(resolvedLocale);
  const handleOpen = useOpenProject();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    await saveAllOpenFiles();
    await saveProject();
    await saveChaptersToProject().catch(() => {});
    // Sync word counts from saved files into novelChapters for overview
    const state = useAppStore.getState();
    const projectPath = state.currentProject?.path;
    if (projectPath && state.novelChapters.length > 0) {
      const base = normalizePath(projectPath);
      const updated = state.novelChapters.map((ch) => ({
        ...ch,
        sections: ch.sections.map((sec) => {
          const fullPath = `${base}/${sec.contentFile}`;
          const file = state.openFiles.find((f) => normalizePath(f.path) === fullPath);
          if (!file) return sec;
          const wc = file.content.replace(/\s/g, '').length;
          return { ...sec, wordCount: wc };
        }),
      }));
      state.setNovelChapters(updated);
    }
    await refreshWordCount();
    showToast(t('topbar.saved'));
  }, [saveProject, saveChaptersToProject, saveAllOpenFiles, refreshWordCount, showToast, t]);

  const handleUndo = useCallback(() => undo(), [undo]);
  const handleRedo = useCallback(() => redo(), [redo]);

  const handleImportDocx = useCallback(async () => {
    const projectPath = currentProject?.path;
    if (!projectPath) return;
    try {
      const rel = await window.orisonDesktop?.importDocx(projectPath);
      if (!rel) return;
      const fullPath = normalizePath(`${projectPath}${rel}`);
      const content = (await window.orisonDesktop?.readFile(fullPath)) ?? '';
      const name = rel.split(/[\\/]/).pop() ?? rel;
      openFile(fullPath, name, content, { kind: 'text' });
      await refreshWordCount();
    } catch {
      showToast(t('fileEditor.docxConvertFailed'), 'error');
    }
  }, [currentProject, openFile, refreshWordCount, showToast, t]);

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

  const activeFilePath = useAppStore((s) => s.activeFilePath);

  const dispatchKey = useCallback((key: string, shift = false) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, metaKey: true, shiftKey: shift, bubbles: true }));
  }, []);

  const fileItems: MenuItem[] = [
    { type: 'action', label: t('topbar.newProject'), shortcut: `${modKey}N`, handler: () => setShowNewDialog(true) },
    { type: 'action', label: t('topbar.openProject'), shortcut: `${modKey}O`, handler: handleOpen },
    { type: 'action', label: t('topbar.openFolder'), handler: handleOpen },
    { type: 'action', label: t('topbar.importDocx'), handler: () => { void handleImportDocx(); }, disabled: !hasSavePath },
    { type: 'action', label: t('topbar.save'), shortcut: `${modKey}S`, handler: handleSave, disabled: !hasSavePath },
    { type: 'action', label: t('topbar.saveAll'), shortcut: `${modKey}Shift+S`, handler: () => { void saveAllOpenFiles(); } },
    { type: 'action', label: t('topbar.export'), handler: () => setShowExport(true), disabled: !hasSavePath },
    { type: 'separator' },
    { type: 'action', label: t('topbar.closeFile'), shortcut: `${modKey}W`, handler: () => { if (activeFilePath) requestCloseFile(activeFilePath); }, disabled: !activeFilePath },
    { type: 'action', label: t('topbar.closeAllFiles'), handler: closeAllFiles, disabled: !activeFilePath },
    { type: 'separator' },
    ...(currentProject
      ? [{ type: 'action' as const, label: t('topbar.backToProjects'), handler: closeProject }]
      : []),
  ];

  const editItems: MenuItem[] = [
    { type: 'action', label: t('topbar.undo'), shortcut: `${modKey}Z`, handler: handleUndo, disabled: undoLen === 0 },
    { type: 'action', label: t('topbar.redo'), shortcut: isMac ? '⌘⇧Z' : 'Ctrl+Shift+Z', handler: handleRedo, disabled: redoLen === 0 },
    { type: 'separator' },
    { type: 'action', label: t('topbar.find'), shortcut: `${modKey}F`, handler: () => dispatchKey('f') },
    { type: 'action', label: t('topbar.replace'), shortcut: `${modKey}H`, handler: () => dispatchKey('h') },
  ];

  const viewItems: MenuItem[] = [
    { type: 'action', label: t('topbar.toggleProjectTree'), shortcut: `${modKey}B`, handler: toggleProjectTree },
    { type: 'action', label: t('topbar.toggleBottomPanel'), shortcut: `${modKey}J`, handler: toggleBottomPanel },
    { type: 'action', label: t('topbar.toggleAgentPanel'), handler: toggleAgentPanel },
    { type: 'action', label: t('topbar.toggleNotifications'), handler: toggleNotificationPanel },
    { type: 'separator' },
    ...(activeFilePath ? [
      { type: 'action' as const, label: t('topbar.splitOutline'), handler: () => setSplit(splitDirection === 'outline' ? 'none' : 'outline') },
      { type: 'action' as const, label: t('topbar.splitRight'), handler: () => setSplit(splitDirection !== 'none' && splitDirection !== 'outline' ? 'none' : 'horizontal', activeFilePath) },
      { type: 'action' as const, label: t('topbar.splitDown'), handler: () => setSplit(splitDirection !== 'none' && splitDirection !== 'outline' ? 'none' : 'vertical', activeFilePath) },
      { type: 'action' as const, label: t('topbar.toggleMinimap'), handler: toggleMinimap },
      { type: 'separator' as const },
    ] : []),
    { type: 'action', label: t('topbar.themeLight'), handler: () => setTheme('light') },
    { type: 'action', label: t('topbar.themeDark'), handler: () => setTheme('dark') },
    { type: 'action', label: t('topbar.themeSystem'), handler: () => setTheme('system') },
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

        <NotificationCenter />
        <WindowControls />
      </header>

      {showNewDialog && <NewProjectDialog onClose={() => setShowNewDialog(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      <UpdateAvailableDialog />
    </>
  );
}
