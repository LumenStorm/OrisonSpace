export type CommandEntry = {
  id: string;
  label: string;
  icon?: string;
  /** Optional keyboard shortcut hint displayed on the right. */
  shortcut?: string;
  handler: () => void;
};

/**
 * Build the full command list from the current app state.
 * Called each time the palette opens so commands reflect live state.
 */
export function buildCommandRegistry(actions: {
  t: (key: string) => string;
  openSettings: () => void;
  openAbout: () => void;
  checkForUpdate: () => void;
  toggleProjectTree: () => void;
  toggleBottomPanel: () => void;
  newProject: () => void;
  openProject: () => void;
  saveFile: () => void;
  closeFile: () => void;
  reopenClosed: () => void;
  exportProject?: () => void;
  saveVersion?: () => void;
}): CommandEntry[] {
  const { t } = actions;
  const cmds: CommandEntry[] = [
    { id: 'settings', label: t('topbar.settings'), icon: 'settings', handler: actions.openSettings },
    { id: 'about', label: t('topbar.about'), icon: 'info', handler: actions.openAbout },
    { id: 'checkUpdate', label: t('topbar.checkForUpdate'), icon: 'update', handler: actions.checkForUpdate },
    { id: 'toggleTree', label: t('topbar.toggleProjectTree'), icon: 'folder', shortcut: 'Ctrl+B', handler: actions.toggleProjectTree },
    { id: 'toggleBottom', label: t('topbar.toggleBottomPanel'), icon: 'bottom_panel_open', shortcut: 'Ctrl+J', handler: actions.toggleBottomPanel },
    { id: 'newProject', label: t('topbar.newProject'), icon: 'add', shortcut: 'Ctrl+N', handler: actions.newProject },
    { id: 'openProject', label: t('topbar.openProject'), icon: 'folder_open', shortcut: 'Ctrl+O', handler: actions.openProject },
    { id: 'save', label: t('topbar.save'), icon: 'save', shortcut: 'Ctrl+S', handler: actions.saveFile },
    { id: 'closeTab', label: t('fileEditor.close'), icon: 'close', shortcut: 'Ctrl+W', handler: actions.closeFile },
    { id: 'reopenClosed', label: t('fileEditor.reopenClosed'), icon: 'history', shortcut: 'Ctrl+Shift+T', handler: actions.reopenClosed },
  ];
  if (actions.exportProject) {
    cmds.push({ id: 'export', label: t('topbar.export'), icon: 'download', handler: actions.exportProject });
  }
  if (actions.saveVersion) {
    cmds.push({ id: 'saveVersion', label: t('statusBar.saveVersion'), icon: 'commit', handler: actions.saveVersion });
  }
  return cmds;
}

/** Simple fuzzy match: all query chars must appear in order. Returns score (lower = better) or -1 for no match. */
export function fuzzyMatch(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let lastIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += ti - lastIdx > 1 ? ti - lastIdx : 0;
      lastIdx = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}
