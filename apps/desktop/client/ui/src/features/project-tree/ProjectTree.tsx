import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ContextMenu, type ContextMenuItem } from '../../shared/components/ContextMenu';
import { mockFileContents } from '../../shared/data/mockFileContents';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore } from '../../shared/store/appStore';
import { isImageFileName } from '../../shared/utils/fileType';
import { FileTreeNode } from './FileTreeNode';
import type { CreatingType, CtxState, FileEntry } from './types';
import { buildInitialTree, findNode, insertChild, removeNode, renameNode, updateChildren } from './treeUtils';

export function ProjectTree() {
  const { currentProject, resolvedLocale, openFile, openFiles } = useAppStore(
    useShallow((state) => ({
      currentProject: state.currentProject,
      resolvedLocale: state.resolvedLocale,
      openFile: state.openFile,
      openFiles: state.openFiles,
    })),
  );
  const activeFilePath = useAppStore((state) => state.activeFilePath);
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

  const dirtyPaths = useMemo(
    () => new Set(openFiles.filter((file) => file.content !== file.savedContent).map((file) => file.path)),
    [openFiles],
  );

  const projectPath = currentProject?.path;
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
      openFile(entry.path, entry.name, mockFileContents[entry.path] ?? '');
      return;
    }

    const fullPath = `${projectPath}${entry.path}`;
    if (isImageFileName(entry.name)) {
      try {
        const payload = await window.orisonDesktop?.readFileBinary?.(fullPath);
        if (payload) {
          const dataUrl = `data:${payload.mimeType};base64,${payload.base64}`;
          openFile(entry.path, entry.name, '', { kind: 'image', dataUrl });
          return;
        }
      } catch {
        // Fall through to placeholder text below.
      }
      openFile(entry.path, entry.name, '', { kind: 'image' });
      return;
    }

    try {
      const content = await window.orisonDesktop?.readFile(fullPath);
      openFile(entry.path, entry.name, content ?? '');
    } catch {
      openFile(entry.path, entry.name, '');
    }
  }, [openFile, projectPath]);

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
          if (projectPath) await window.orisonDesktop?.deleteEntry(`${projectPath}${entry.path}`);
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
  }, [ctxMenu, t, currentProject, projectPath]);

  const handleRenameConfirm = useCallback(async (oldPath: string, newName: string) => {
    if (projectPath) {
      const oldFull = `${projectPath}${oldPath}`;
      const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/';
      const newRelative = parentDir === '/' ? `/${newName}` : `${parentDir}/${newName}`;
      await window.orisonDesktop?.renameEntry(oldFull, `${projectPath}${newRelative}`);
    }
    setFileTree((prev) => prev ? renameNode(prev, oldPath, newName) : prev);
    setRenamingPath(null);
  }, [projectPath]);

  const handleCreateConfirm = useCallback(async (name: string) => {
    if (!creatingIn || !creatingType) return;
    const isDir = creatingType === 'folder';
    const newPath = creatingIn === '/' ? `/${name}` : `${creatingIn}/${name}`;
    if (projectPath) await window.orisonDesktop?.createEntry(`${projectPath}${newPath}`, isDir);
    const child: FileEntry = { name, path: newPath, isDir, children: isDir ? [] : undefined };
    setFileTree((prev) => prev ? insertChild(prev, creatingIn, child) : prev);
    setCreatingIn(null);
    setCreatingType(null);
  }, [creatingIn, creatingType, projectPath]);

  const handleCreateCancel = useCallback(() => {
    setCreatingIn(null);
    setCreatingType(null);
  }, []);

  if (!currentProject || !fileTree) return null;

  return (
    <aside className="project-tree-panel" aria-label="Project Files">
      <div className="ptree-header">
        <span className="ptree-header-title">{t('projectTree.title')}</span>
      </div>
      <div
        className="ptree-list"
        onContextMenu={(event) => {
          event.preventDefault();
          setCtxMenu({ x: event.clientX, y: event.clientY, entry: null });
        }}
      >
        {fileTree.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            expandedPaths={expandedPaths}
            onToggle={handleToggle}
            selectedPath={activeFilePath}
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
