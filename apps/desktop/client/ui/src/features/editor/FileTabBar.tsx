import { useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../../shared/i18n/useI18n';
import { ContextMenu, type ContextMenuItem } from '../../shared/components/ContextMenu';
import { ConfirmCloseDialog } from './ConfirmCloseDialog';
import type { FileTab } from '../../shared/store/fileTabsSlice';

function getTabIcon(tab: FileTab): string {
  const name = tab.name;
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'data_object';
  if (name.endsWith('.md')) return 'article';
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.webp')) return 'image';
  return 'draft';
}

type CtxMenuState = { x: number; y: number; tab: FileTab } | null;

export function FileTabBar() {
  const {
    openFiles, activeFilePath, openFile, closeFile, requestCloseFile, cancelCloseConfirm,
    closeOtherFiles, closeFilesToRight, reopenLastClosedFile, pendingCloseConfirm,
    hasRecentlyClosed, locale,
  } = useAppStore(
    useShallow((s) => ({
      openFiles: s.openFiles,
      activeFilePath: s.activeFilePath,
      openFile: s.openFile,
      closeFile: s.closeFile,
      requestCloseFile: s.requestCloseFile,
      cancelCloseConfirm: s.cancelCloseConfirm,
      closeOtherFiles: s.closeOtherFiles,
      closeFilesToRight: s.closeFilesToRight,
      reopenLastClosedFile: s.reopenLastClosedFile,
      pendingCloseConfirm: s.pendingCloseConfirm,
      hasRecentlyClosed: s.recentlyClosed.length > 0,
      locale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(locale);

  const [ctx, setCtx] = useState<CtxMenuState>(null);

  if (openFiles.length === 0 && !pendingCloseConfirm) return null;

  const handleCloseClick = (e: React.MouseEvent, tab: FileTab) => {
    e.stopPropagation();
    requestCloseFile(tab.path);
  };

  const handleContextMenu = (e: React.MouseEvent, tab: FileTab) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY, tab });
  };

  const buildCtxItems = (tab: FileTab): ContextMenuItem[] => [
    {
      type: 'item',
      label: t('fileEditor.close'),
      icon: 'close',
      onClick: () => requestCloseFile(tab.path),
    },
    {
      type: 'item',
      label: t('fileEditor.closeOthers'),
      icon: 'tab',
      disabled: openFiles.length <= 1,
      onClick: () => closeOtherFiles(tab.path),
    },
    {
      type: 'item',
      label: t('fileEditor.closeToRight'),
      icon: 'last_page',
      disabled: openFiles[openFiles.length - 1]?.path === tab.path,
      onClick: () => closeFilesToRight(tab.path),
    },
    { type: 'separator' },
    {
      type: 'item',
      label: t('fileEditor.reopenClosed'),
      icon: 'history',
      disabled: !hasRecentlyClosed,
      onClick: () => { void reopenLastClosedFile(); },
    },
    { type: 'separator' },
    {
      type: 'item',
      label: t('fileEditor.copyPath'),
      icon: 'content_copy',
      onClick: () => { void navigator.clipboard?.writeText?.(tab.path); },
    },
    {
      type: 'item',
      label: t('fileEditor.showInExplorer'),
      icon: 'folder_open',
      onClick: () => { window.orisonDesktop?.showItemInFolder?.(tab.path); },
    },
  ];

  const confirmTab = pendingCloseConfirm
    ? openFiles.find((f) => f.path === pendingCloseConfirm)
    : null;

  return (
    <>
      {openFiles.length > 0 && (
        <nav className="file-tab-bar" aria-label="Open files">
          {openFiles.map((file) => {
            const isActive = file.path === activeFilePath;
            const isDirty = file.kind === 'text' && file.content !== file.savedContent;
            return (
              <div
                key={file.path}
                className={`file-tab${isActive ? ' file-tab-active' : ''}`}
                onClick={() => openFile(file.path, file.name, file.content, { kind: file.kind, dataUrl: file.dataUrl })}
                onContextMenu={(e) => handleContextMenu(e, file)}
                onAuxClick={(e) => {
                  if (e.button === 1) handleCloseClick(e, file);
                }}
              >
                <span className="material-symbols-outlined file-tab-icon" aria-hidden="true">
                  {getTabIcon(file)}
                </span>
                <span className="file-tab-name">{file.name}</span>
                {isDirty && <span className="file-tab-dirty" aria-label="unsaved">●</span>}
                <button
                  type="button"
                  className="file-tab-close"
                  aria-label={`Close ${file.name}`}
                  onClick={(e) => handleCloseClick(e, file)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
            );
          })}
        </nav>
      )}

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={buildCtxItems(ctx.tab)}
          onClose={() => setCtx(null)}
        />
      )}

      {confirmTab && (
        <ConfirmCloseDialog
          fileName={confirmTab.name}
          filePath={confirmTab.path}
          onClose={cancelCloseConfirm}
        />
      )}
    </>
  );
}

