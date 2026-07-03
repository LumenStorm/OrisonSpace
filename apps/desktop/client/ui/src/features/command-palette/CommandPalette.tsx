import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../../shared/i18n/useI18n';
import { useOpenProject } from '../../shared/hooks/useOpenProject';
import { buildCommandRegistry, fuzzyMatch, type CommandEntry } from './commandRegistry';

export function CommandPalette() {
  const { open, mode, close, locale } = useAppStore(
    useShallow((s) => ({
      open: s.paletteOpen,
      mode: s.paletteMode,
      close: s.closePalette,
      locale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(locale);
  const handleOpenProject = useOpenProject();

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build commands from current state
  const commands = useMemo(() => {
    if (!open) return [];
    const state = useAppStore.getState();
    return buildCommandRegistry({
      t,
      openSettings: () => state.setSettingsDialogOpen(true),
      openAbout: () => state.setAboutDialogOpen(true),
      checkForUpdate: () => { void state.checkForUpdate(); },
      toggleProjectTree: () => state.toggleProjectTree(),
      toggleBottomPanel: () => state.toggleBottomPanel(),
      newProject: () => state.setNewProjectDialogOpen(true),
      openProject: () => { void handleOpenProject(); },
      saveFile: () => {
        const active = state.activeFilePath;
        if (active) void state.saveFile(active);
      },
      closeFile: () => {
        const active = state.activeFilePath;
        if (active) state.requestCloseFile(active);
      },
      reopenClosed: () => { void state.reopenLastClosedFile(); },
      saveVersion: state.currentProject?.path ? () => {
        // window.prompt is disabled in the Electron renderer, so auto-generate a
        // timestamped snapshot message — same behaviour as the overview snapshot.
        const dir = state.currentProject!.path;
        const now = new Date();
        const msg = `snapshot: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        void window.orisonDesktop?.gitCreateNode(dir, msg);
      } : undefined,
    });
  }, [open, t, handleOpenProject]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    return commands
      .map((cmd) => ({ cmd, score: fuzzyMatch(query, cmd.label) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.cmd);
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [filtered.length]);

  const execute = useCallback(
    (cmd: CommandEntry) => {
      close();
      cmd.handler();
    },
    [close],
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) execute(filtered[selectedIdx]);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="cmd-palette-overlay" onClick={close}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('commandPalette.title')}>
        <input
          ref={inputRef}
          className="cmd-palette-input"
          placeholder={mode === 'commands' ? t('commandPalette.commandPlaceholder') : t('commandPalette.filePlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <ul className="cmd-palette-list" role="listbox">
          {filtered.map((cmd, i) => (
            <li
              key={cmd.id}
              role="option"
              aria-selected={i === selectedIdx}
              className={`cmd-palette-item${i === selectedIdx ? ' is-selected' : ''}`}
              onClick={() => execute(cmd)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              {cmd.icon && (
                <span className="material-symbols-outlined cmd-palette-item-icon" aria-hidden="true">
                  {cmd.icon}
                </span>
              )}
              <span className="cmd-palette-item-label">{cmd.label}</span>
              {cmd.shortcut && <span className="cmd-palette-item-shortcut">{cmd.shortcut}</span>}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="cmd-palette-empty">{t('commandPalette.noResults')}</li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
