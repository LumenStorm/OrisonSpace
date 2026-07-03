import { useRef, useState } from 'react';
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
    openFiles, activeFilePath, openFile, closeFile: _closeFile, requestCloseFile, cancelCloseConfirm,
    closeOtherFiles, closeFilesToRight, reopenLastClosedFile, pendingCloseConfirm,
    hasRecentlyClosed, locale, pinnedPaths, togglePinTab, reorderTabs, setSplit,
    splitDirection,
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
      pinnedPaths: s.pinnedPaths,
      togglePinTab: s.togglePinTab,
      reorderTabs: s.reorderTabs,
      setSplit: s.setSplit,
      splitDirection: s.splitDirection,
    })),
  );
  const { t } = useI18n(locale);

  const [ctx, setCtx] = useState<CtxMenuState>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

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
      label: pinnedPaths.has(tab.path) ? (t('fileEditor.unpin') || 'Unpin') : (t('fileEditor.pin') || 'Pin'),
      icon: pinnedPaths.has(tab.path) ? 'push_pin' : 'push_pin',
      onClick: () => togglePinTab(tab.path),
    },
    { type: 'separator' },
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
    { type: 'separator' },
    {
      type: 'item',
      label: t('fileEditor.splitRight') || 'Split Right',
      icon: 'vertical_split',
      onClick: () => setSplit('horizontal', tab.path),
    },
    {
      type: 'item',
      label: t('fileEditor.splitDown') || 'Split Down',
      icon: 'horizontal_split',
      onClick: () => setSplit('vertical', tab.path),
    },
    { type: 'separator' },
    {
      type: 'item',
      label: t('fileEditor.splitOutline') || 'Split Outline',
      icon: 'view_sidebar',
      onClick: () => setSplit('outline'),
    },
  ];

  const confirmTab = pendingCloseConfirm
    ? openFiles.find((f) => f.path === pendingCloseConfirm)
    : null;

  return (
    <>
      {openFiles.length > 0 && (
        <div className="file-tab-bar-wrapper">
          <nav
            className="file-tab-bar"
            role="tablist"
            aria-label={t('editor.openFiles')}
            onWheel={(e) => {
              // Translate vertical wheel into horizontal scroll so the mouse
              // wheel can reveal off-screen tabs. Only intercept when the row
              // actually overflows and the gesture has no native horizontal
              // intent (trackpad / Shift+wheel already scroll sideways).
              const el = e.currentTarget;
              if (el.scrollWidth <= el.clientWidth) return;
              if (e.deltaX !== 0) return;
              el.scrollLeft += e.deltaY;
            }}
          >
            {openFiles.map((file, index) => {
            const isActive = file.path === activeFilePath;
            const isDirty = file.kind === 'text' && file.content !== file.savedContent;
            const isPinned = pinnedPaths.has(file.path);
            return (
              <div
                key={file.path}
                className={`file-tab${isActive ? ' file-tab-active' : ''}${isPinned ? ' file-tab-pinned' : ''}${dropTarget === index ? ' file-tab-drop-target' : ''}`}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                draggable
                onDragStart={() => { dragIndexRef.current = index; }}
                onDragOver={(e) => { e.preventDefault(); setDropTarget(index); }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={() => {
                  if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
                    reorderTabs(dragIndexRef.current, index);
                  }
                  dragIndexRef.current = null;
                  setDropTarget(null);
                }}
                onDragEnd={() => { dragIndexRef.current = null; setDropTarget(null); }}
                onClick={() => openFile(file.path, file.name, file.content, { kind: file.kind, dataUrl: file.dataUrl })}
                onContextMenu={(e) => handleContextMenu(e, file)}
                onAuxClick={(e) => {
                  if (e.button === 1) handleCloseClick(e, file);
                }}
              >
                {isPinned && (
                  <span className="material-symbols-outlined file-tab-pin-icon" aria-hidden="true">push_pin</span>
                )}
                <span className="material-symbols-outlined file-tab-icon" aria-hidden="true">
                  {getTabIcon(file)}
                </span>
                <span className="file-tab-name">{file.name}</span>
                {isDirty && <span className="file-tab-dirty" aria-label={t('editor.unsaved')}>●</span>}
                {!isPinned && (
                  <button
                    type="button"
                    className="file-tab-close"
                    aria-label={t('editor.closeTab', { name: file.name })}
                    onClick={(e) => handleCloseClick(e, file)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                  </button>
                )}
              </div>
            );
          })}
        </nav>
        <div className="file-tab-bar-actions">
          {splitDirection === 'none' && (
            <button type="button" className="file-tab-bar-action-btn" title={t('fileEditor.splitOutline') || 'Split Outline'} aria-label={t('fileEditor.splitOutline') || 'Split Outline'} onClick={() => setSplit('outline')}>
              <span className="material-symbols-outlined" aria-hidden="true">view_sidebar</span>
            </button>
          )}
          {splitDirection === 'outline' && (
            <button type="button" className="file-tab-bar-action-btn" title={t('fileEditor.closeSplit') || 'Close Split'} aria-label={t('fileEditor.closeSplit') || 'Close Split'} onClick={() => setSplit('none')}>
              <span className="material-symbols-outlined" aria-hidden="true">view_sidebar</span>
            </button>
          )}
          {splitDirection !== 'none' && splitDirection !== 'outline' && (
            <button type="button" className="file-tab-bar-action-btn" title={t('fileEditor.closeSplit') || 'Close Split'} aria-label={t('fileEditor.closeSplit') || 'Close Split'} onClick={() => setSplit('none')}>
              <span className="material-symbols-outlined" aria-hidden="true">view_sidebar</span>
            </button>
          )}
        </div>
        </div>
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

