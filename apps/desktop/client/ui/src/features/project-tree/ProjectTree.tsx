import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ContextMenu, type ContextMenuItem } from '../../shared/components/ContextMenu';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore } from '../../shared/store/appStore';
import { useToastStore } from '../../shared/store/toastStore';
import { isImageFileName, isDocxFileName } from '../../shared/utils/fileType';
import { normalizePath } from '../../shared/utils/paths';
import { FileTreeNode } from './FileTreeNode';
import type { CreatingType, CtxState, FileEntry } from './types';
import { buildInitialTree, findNode, insertChild, removeNode, renameNode, updateChildren } from './treeUtils';

export function ProjectTree() {
  const { currentProject, resolvedLocale, openFile, openFiles, renameOpenFile, closeFilesUnder } = useAppStore(
    useShallow((state) => ({
      currentProject: state.currentProject,
      resolvedLocale: state.resolvedLocale,
      openFile: state.openFile,
      openFiles: state.openFiles,
      renameOpenFile: state.renameOpenFile,
      closeFilesUnder: state.closeFilesUnder,
    })),
  );
  const activeFilePath = useAppStore((state) => state.activeFilePath);
  const mainView = useAppStore((state) => state.mainView);
  const { t } = useI18n(resolvedLocale);

  const displayNameMap = useMemo<Record<string, string>>(() => ({
    chapters: t('projectTree.chapters'),
    scenes: t('projectTree.scenes'),
    assets: t('projectTree.assetsDir'),
    'project.yaml': t('projectTree.projectConfig'),
  }), [t]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [fileTree, setFileTree] = useState<FileEntry[] | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxState>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<CreatingType>(null);
  const [dragActive, setDragActive] = useState(false);

  const projectPath = currentProject?.path;

  const dirtyPaths = useMemo(
    () => {
      const base = projectPath ? normalizePath(projectPath) : '';
      return new Set(
        openFiles
          .filter((file) => file.content !== file.savedContent)
          .map((file) => {
            const np = normalizePath(file.path);
            return base && np.startsWith(base) ? np.slice(base.length) : np;
          }),
      );
    },
    [openFiles, projectPath],
  );

  useEffect(() => {
    if (!currentProject) return;
    let cancelled = false;

    const loadTree = async () => {
      if (projectPath && window.orisonDesktop?.readDirectory) {
        try {
          const entries = await window.orisonDesktop.readDirectory(projectPath, 1);
          if (!cancelled && entries && entries.length > 0) {
            setFileTree([{ name: currentProject.name, path: '/', isDir: true, children: entries }]);
            return;
          }
        } catch {
          // Fall through to mock data.
        }
      }
      if (!cancelled) setFileTree(buildInitialTree(currentProject.name));
    };

    void loadTree();
    return () => { cancelled = true; };
  }, [currentProject, projectPath]);

  // Re-read the project tree (depth 3) and re-hydrate any directories the user
  // had expanded beyond that depth, so an external change / manual refresh
  // doesn't collapse lazily-loaded deep subtrees.
  const refreshTree = useCallback(async () => {
    if (!projectPath || !currentProject) return;
    const entries = await window.orisonDesktop?.readDirectory?.(projectPath, 3);
    if (!entries?.length) return;
    let tree: FileEntry[] = [{ name: currentProject.name, path: '/', isDir: true, children: entries }];

    // For each expanded directory whose children weren't included in the shallow
    // read (depth > 3), fetch one more level so it stays open after refresh.
    const expanded = [...expandedPaths].filter((p) => p !== '/');
    for (const dirPath of expanded) {
      const node = findNode(tree, dirPath);
      if (!node || !node.isDir || (node.children && node.children.length > 0)) continue;
      try {
        const children = await window.orisonDesktop?.readDirectory(`${projectPath}${dirPath}`, 1);
        if (!children) continue;
        const remapped = children.map((child: FileEntry) => ({
          ...child,
          path: dirPath === '/' ? `/${child.name}` : `${dirPath}/${child.name}`,
          children: child.isDir ? (child.children ?? []) : undefined,
        }));
        tree = updateChildren(tree, dirPath, remapped);
      } catch {
        // Best-effort re-hydration; a failed deep dir simply shows collapsed.
      }
    }
    setFileTree(tree);
  }, [projectPath, currentProject, expandedPaths]);

  // External changes (watcher `file:changed`, agent `image:created`) refresh the
  // tree through the same path-preserving refresh used by the manual button.
  useEffect(() => {
    if (!projectPath || !currentProject) return;
    const handler = (e: Event) => {
      const { type } = (e as CustomEvent).detail ?? {};
      if (type === 'file:changed' || type === 'image:created') {
        void refreshTree();
      }
    };
    window.addEventListener('orison:tool-event', handler);
    return () => window.removeEventListener('orison:tool-event', handler);
  }, [projectPath, currentProject, refreshTree]);

  // Watch the project directory for changes made outside the app (Explorer/Finder,
  // other tools). The watcher emits `file:changed`, handled by the effect above.
  // On platforms without recursive watch (Linux) the manual refresh button is the
  // fallback.
  useEffect(() => {
    if (!projectPath) return;
    void window.orisonDesktop?.watchProject?.(projectPath);
    return () => { void window.orisonDesktop?.unwatchProject?.(); };
  }, [projectPath]);

  const handleDrop = useCallback(async (event: DragEvent, targetDir: string) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (!projectPath) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    const sourcePaths = files
      .map((file) => window.orisonDesktop?.pathForFile?.(file) ?? '')
      .filter((p) => p.length > 0);
    if (sourcePaths.length === 0) return;
    try {
      await window.orisonDesktop?.importFiles?.(projectPath, targetDir, sourcePaths);
      if (targetDir && targetDir !== '/') {
        setExpandedPaths((prev) => new Set(prev).add(targetDir));
      }
      await refreshTree();
    } catch {
      // Import failures are non-fatal; the tree simply won't change.
    }
  }, [projectPath, refreshTree]);

  const loadChildrenIfNeeded = useCallback(async (entry: FileEntry) => {
    if (!projectPath || !entry.isDir || (entry.children && entry.children.length > 0)) return;
    const fullDir = `${projectPath}${entry.path}`;
    try {
      const children = await window.orisonDesktop?.readDirectory(fullDir, 1);
      if (!children) return;
      const remapped = children.map((child: FileEntry) => ({
        ...child,
        path: entry.path === '/' ? `/${child.name}` : `${entry.path}/${child.name}`,
        children: child.isDir ? (child.children ?? []) : undefined,
      }));
      setFileTree((prev) => prev ? updateChildren(prev, entry.path, remapped) : prev);
    } catch {
      // Ignore lazy-load failures; users can retry by expanding again.
    }
  }, [projectPath]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        const entry = findNode(fileTree, path);
        if (entry) void loadChildrenIfNeeded(entry);
      }
      return next;
    });
  }, [fileTree, loadChildrenIfNeeded]);

  const handleSelect = useCallback(async (entry: FileEntry) => {
    if (entry.isDir) return;

    if (!projectPath) {
      useToastStore.getState().showToast(t('projectTree.noProjectPath'), 'error');
      return;
    }

    const fullPath = normalizePath(`${projectPath}${entry.path}`);
    if (isImageFileName(entry.name)) {
      try {
        const payload = await window.orisonDesktop?.readFileBinary?.(fullPath);
        if (payload) {
          const dataUrl = `data:${payload.mimeType};base64,${payload.base64}`;
          openFile(fullPath, entry.name, '', { kind: 'image', dataUrl });
          return;
        }
      } catch {
        // Fall through to placeholder text below.
      }
      openFile(fullPath, entry.name, '', { kind: 'image' });
      return;
    }

    if (isDocxFileName(entry.name)) {
      try {
        const html = await window.orisonDesktop?.docxToHtml(fullPath);
        openFile(fullPath, entry.name, html ?? '', { kind: 'docx' });
      } catch {
        openFile(fullPath, entry.name, '', { kind: 'docx' });
      }
      return;
    }

    try {
      const content = await window.orisonDesktop?.readFile(fullPath);
      openFile(fullPath, entry.name, content ?? '');
    } catch {
      openFile(fullPath, entry.name, '');
    }
  }, [openFile, projectPath, t]);

  const handleContextMenu = useCallback((event: React.MouseEvent, entry: FileEntry) => {
    event.preventDefault();
    event.stopPropagation();
    setCtxMenu({ x: event.clientX, y: event.clientY, entry });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const ctxItems: ContextMenuItem[] = useMemo(() => {
    if (!ctxMenu) return [];
    const { entry } = ctxMenu;
    const items: ContextMenuItem[] = [];

    if (!entry) {
      items.push({
        type: 'item', label: t('contextMenu.newFile'), icon: 'note_add',
        onClick: () => {
          setCreatingIn('/');
          setCreatingType('file');
          setExpandedPaths((prev) => new Set(prev).add('/'));
        },
      });
      items.push({
        type: 'item', label: t('contextMenu.newFolder'), icon: 'create_new_folder',
        onClick: () => {
          setCreatingIn('/');
          setCreatingType('folder');
          setExpandedPaths((prev) => new Set(prev).add('/'));
        },
      });
      items.push({ type: 'separator' });
      items.push({
        type: 'item', label: t('contextMenu.openInExplorer'), icon: 'folder_open',
        onClick: () => {
          const dir = currentProject?.path;
          if (dir) window.orisonDesktop?.openPath(dir);
        },
      });
      return items;
    }

    if (entry.isDir) {
      items.push({
        type: 'item', label: t('contextMenu.newFile'), icon: 'note_add',
        onClick: () => {
          setCreatingIn(entry.path);
          setCreatingType('file');
          setExpandedPaths((prev) => new Set(prev).add(entry.path));
        },
      });
      items.push({
        type: 'item', label: t('contextMenu.newFolder'), icon: 'create_new_folder',
        onClick: () => {
          setCreatingIn(entry.path);
          setCreatingType('folder');
          setExpandedPaths((prev) => new Set(prev).add(entry.path));
        },
      });
      items.push({ type: 'separator' });
    }

    if (entry.path !== '/') {
      items.push({
        type: 'item', label: t('contextMenu.rename'), icon: 'edit',
        onClick: () => setRenamingPath(entry.path),
      });
      items.push({
        type: 'item', label: t('contextMenu.delete'), icon: 'delete', danger: true,
        onClick: async () => {
          // Confirm before an irreversible delete (directories are recursive).
          const confirmMsg = entry.isDir
            ? t('projectTree.deleteConfirmDir', { name: entry.name })
            : t('projectTree.deleteConfirmFile', { name: entry.name });
          if (!window.confirm(confirmMsg)) return;
          if (projectPath) {
            const fullPath = normalizePath(`${projectPath}${entry.path}`);
            const ok = await window.orisonDesktop?.deleteEntry(`${projectPath}${entry.path}`);
            if (ok === false) {
              useToastStore.getState().showToast(t('projectTree.deleteFailed'), 'error');
              return;
            }
            // Close any open tab for the deleted file (or files nested under a
            // deleted directory) so a "ghost" tab can't re-create it on save.
            closeFilesUnder(fullPath);
          }
          setFileTree((prev) => prev ? removeNode(prev, entry.path) : prev);
        },
      });
      items.push({ type: 'separator' });
    }

    items.push({
      type: 'item', label: t('contextMenu.openInExplorer'), icon: 'folder_open',
      onClick: () => {
        const dir = currentProject?.path;
        if (!dir) return;
        const fullPath = entry.path === '/' ? dir : `${dir}${entry.path}`;
        if (entry.isDir) window.orisonDesktop?.openPath(fullPath);
        else window.orisonDesktop?.showItemInFolder(fullPath);
      },
    });

    return items;
  }, [ctxMenu, t, currentProject, projectPath, closeFilesUnder]);

  const handleRenameConfirm = useCallback(async (oldPath: string, newName: string) => {
    const trimmed = newName.trim();
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/';
    const newRelative = parentDir === '/' ? `/${trimmed}` : `${parentDir}/${trimmed}`;
    // No-op rename (same name) — just close the editor.
    if (newRelative === oldPath) {
      setRenamingPath(null);
      return;
    }
    // Reject invalid names and collisions with an existing sibling.
    if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
      useToastStore.getState().showToast(t('projectTree.invalidName'), 'error');
      return;
    }
    if (findNode(fileTree, newRelative)) {
      useToastStore.getState().showToast(t('projectTree.nameExists', { name: trimmed }), 'error');
      return;
    }
    if (projectPath) {
      const oldFull = normalizePath(`${projectPath}${oldPath}`);
      const newFull = normalizePath(`${projectPath}${newRelative}`);
      const ok = await window.orisonDesktop?.renameEntry(oldFull, newFull);
      if (ok === false) {
        useToastStore.getState().showToast(t('projectTree.renameFailed'), 'error');
        setRenamingPath(null);
        return;
      }
      // Rebase open tabs (incl. files nested under a renamed directory) and split.
      renameOpenFile(oldFull, newFull, trimmed);
    }
    setFileTree((prev) => prev ? renameNode(prev, oldPath, trimmed) : prev);
    setRenamingPath(null);
  }, [projectPath, fileTree, renameOpenFile, t]);

  const handleCreateConfirm = useCallback(async (name: string) => {
    if (!creatingIn || !creatingType) return;
    const trimmed = name.trim();
    const isDir = creatingType === 'folder';
    // Reject invalid names (separators / traversal) before touching disk.
    if (!trimmed || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
      useToastStore.getState().showToast(t('projectTree.invalidName'), 'error');
      return;
    }
    const newPath = creatingIn === '/' ? `/${trimmed}` : `${creatingIn}/${trimmed}`;
    // Pre-check for an existing sibling so we never silently overwrite a file.
    if (findNode(fileTree, newPath)) {
      useToastStore.getState().showToast(t('projectTree.nameExists', { name: trimmed }), 'error');
      return;
    }
    if (projectPath) {
      const ok = await window.orisonDesktop?.createEntry(`${projectPath}${newPath}`, isDir);
      if (ok === false) {
        // Main rejected it (collision/invalid that slipped past the UI check).
        useToastStore.getState().showToast(t('projectTree.createFailed'), 'error');
        setCreatingIn(null);
        setCreatingType(null);
        return;
      }
    }
    const child: FileEntry = { name: trimmed, path: newPath, isDir, children: isDir ? [] : undefined };
    setFileTree((prev) => prev ? insertChild(prev, creatingIn, child) : prev);
    setCreatingIn(null);
    setCreatingType(null);
    // Open the freshly created file so the user can start editing immediately.
    if (!isDir && projectPath) {
      const fullPath = normalizePath(`${projectPath}${newPath}`);
      openFile(fullPath, trimmed, '');
    }
  }, [creatingIn, creatingType, projectPath, fileTree, openFile, t]);

  const handleCreateCancel = useCallback(() => {
    setCreatingIn(null);
    setCreatingType(null);
  }, []);

  if (!currentProject || !fileTree) return null;

  return (
    <aside className="project-tree-panel" aria-label={t('projectTree.ariaLabel')}>
      <div className="ptree-header">
        <span className="ptree-header-title">{t('projectTree.title')}</span>
        <button
          type="button"
          className="ptree-header-btn"
          onClick={() => void refreshTree()}
          title={t('projectTree.refresh')}
          aria-label={t('projectTree.refresh')}
        >
          <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
        </button>
      </div>
      <div
        className={`ptree-list${dragActive ? ' ptree-list--drag-active' : ''}`}
        role="tree"
        aria-label={t('projectTree.ariaLabel')}
        onContextMenu={(event) => {
          event.preventDefault();
          setCtxMenu({ x: event.clientX, y: event.clientY, entry: null });
        }}
        onDragOver={(event) => {
          if (!projectPath) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          if (!dragActive) setDragActive(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragActive(false);
          }
        }}
        onDrop={(event) => void handleDrop(event, '/')}
      >
        {fileTree.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            expandedPaths={expandedPaths}
            onToggle={handleToggle}
            selectedPath={mainView === 'files' ? activeFilePath : null}
            onSelect={handleSelect}
            dirtyPaths={dirtyPaths}
            onContextMenu={handleContextMenu}
            renamingPath={renamingPath}
            onRenameConfirm={handleRenameConfirm}
            onRenameCancel={() => setRenamingPath(null)}
            creatingIn={creatingIn}
            creatingType={creatingType}
            onCreateConfirm={handleCreateConfirm}
            onCreateCancel={handleCreateCancel}
            displayNameMap={displayNameMap}
            onDropToFolder={(event, folderPath) => void handleDrop(event, folderPath)}
            t={t}
          />
        ))}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxItems}
          onClose={closeCtxMenu}
        />
      )}
    </aside>
  );
}
