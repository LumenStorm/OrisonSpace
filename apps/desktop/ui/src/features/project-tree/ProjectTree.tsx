import { useState, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { mockFileContents } from '../../shared/data/mockFileContents';
import { ContextMenu, type ContextMenuItem } from '../../shared/components/ContextMenu';
import { Tooltip } from '../../shared/components/Tooltip';

/* ── Types ── */

type FileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
};

type CtxState = { x: number; y: number; entry: FileEntry | null } | null;

/* ── Helpers ── */

function getFileIcon(name: string, isDir: boolean, isOpen: boolean): string {
  if (isDir) return isOpen ? 'folder_open' : 'folder';
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'data_object';
  if (name.endsWith('.md')) return 'article';
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.webp')) return 'image';
  if (name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm')) return 'movie';
  return 'draft';
}

function getDisplayName(name: string): string {
  return name.endsWith('/') ? name.slice(0, -1) : name;
}

function buildInitialTree(projectName: string): FileEntry[] {
  return [
    {
      name: projectName,
      path: '/',
      isDir: true,
      children: [
        { name: 'project.yaml', path: '/project.yaml', isDir: false },
        {
          name: 'chapters',
          path: '/chapters',
          isDir: true,
          children: [
            { name: 'ch-001.md', path: '/chapters/ch-001.md', isDir: false },
            { name: 'ch-002.md', path: '/chapters/ch-002.md', isDir: false },
          ],
        },
        {
          name: 'scenes',
          path: '/scenes',
          isDir: true,
          children: [
            { name: 'sc-001.md', path: '/scenes/sc-001.md', isDir: false },
            { name: 'sc-002.md', path: '/scenes/sc-002.md', isDir: false },
          ],
        },
        {
          name: 'assets',
          path: '/assets',
          isDir: true,
          children: [],
        },
      ],
    },
  ];
}

/* ── Tree mutation helpers (immutable) ── */

function insertChild(tree: FileEntry[], parentPath: string, child: FileEntry): FileEntry[] {
  return tree.map((node) => {
    if (node.path === parentPath && node.isDir) {
      const children = [...(node.children ?? []), child];
      children.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: insertChild(node.children, parentPath, child) };
    }
    return node;
  });
}

function removeNode(tree: FileEntry[], targetPath: string): FileEntry[] {
  return tree
    .filter((n) => n.path !== targetPath)
    .map((n) => (n.children ? { ...n, children: removeNode(n.children, targetPath) } : n));
}

function renameNode(tree: FileEntry[], targetPath: string, newName: string): FileEntry[] {
  return tree.map((node) => {
    if (node.path === targetPath) {
      const parentDir = targetPath.substring(0, targetPath.lastIndexOf('/')) || '/';
      const newPath = parentDir === '/' ? `/${newName}` : `${parentDir}/${newName}`;
      const updated: FileEntry = { ...node, name: newName, path: newPath };
      if (node.isDir && node.children) {
        updated.children = rebasePaths(node.children, node.path, newPath);
      }
      return updated;
    }
    if (node.children) {
      return { ...node, children: renameNode(node.children, targetPath, newName) };
    }
    return node;
  });
}

function rebasePaths(tree: FileEntry[], oldPrefix: string, newPrefix: string): FileEntry[] {
  return tree.map((node) => {
    const newPath = newPrefix + node.path.slice(oldPrefix.length);
    const updated: FileEntry = { ...node, path: newPath };
    if (node.children) {
      updated.children = rebasePaths(node.children, oldPrefix, newPrefix);
    }
    return updated;
  });
}

function getParentPath(path: string): string {
  if (path === '/') return '/';
  const idx = path.lastIndexOf('/');
  return idx <= 0 ? '/' : path.substring(0, idx);
}

/* ── Inline rename input ── */

function InlineInput({
  defaultValue,
  onConfirm,
  onCancel,
}: {
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleBlur = () => {
    const v = ref.current?.value.trim();
    if (v && v !== defaultValue) onConfirm(v);
    else onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = ref.current?.value.trim();
      if (v && v !== defaultValue) onConfirm(v);
      else onCancel();
    }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <input
      ref={ref}
      className="ptree-inline-input"
      defaultValue={defaultValue}
      autoFocus
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/* ── FileTreeNode ── */

function FileTreeNode({
  entry,
  depth = 0,
  expandedPaths,
  onToggle,
  selectedPath,
  onSelect,
  dirtyPaths,
  onContextMenu,
  renamingPath,
  onRenameConfirm,
  onRenameCancel,
  creatingIn,
  creatingType,
  onCreateConfirm,
  onCreateCancel,
  displayNameMap,
}: {
  entry: FileEntry;
  depth?: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  dirtyPaths: Set<string>;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  renamingPath: string | null;
  onRenameConfirm: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
  creatingIn: string | null;
  creatingType: 'file' | 'folder' | null;
  onCreateConfirm: (name: string) => void;
  onCreateCancel: () => void;
  displayNameMap: Record<string, string>;
}) {
  const paddingLeft = 8 + depth * 16;
  const isExpanded = expandedPaths.has(entry.path);
  const isSelected = entry.path === selectedPath;
  const isDirty = dirtyPaths.has(entry.path);
  const isRenaming = renamingPath === entry.path;
  const isCreatingHere = creatingIn === entry.path;

  const rawName = getDisplayName(entry.name);
  const mappedName = displayNameMap[entry.name] ?? rawName;
  const showTooltip = mappedName !== rawName;

  if (entry.isDir) {
    return (
      <div className="ptree-group">
        <div
          className={`ptree-node ptree-folder${isSelected ? ' is-active' : ''}`}
          style={{ paddingLeft }}
          onClick={() => onToggle(entry.path)}
          onContextMenu={(e) => onContextMenu(e, entry)}
        >
          <span className={`material-symbols-outlined ptree-chevron${isExpanded ? ' is-open' : ''}`} aria-hidden="true">
            chevron_right
          </span>
          <span className="material-symbols-outlined ptree-icon" aria-hidden="true">
            {getFileIcon(entry.name, true, isExpanded)}
          </span>
          {isRenaming ? (
            <InlineInput
              defaultValue={getDisplayName(entry.name)}
              onConfirm={(v) => onRenameConfirm(entry.path, v)}
              onCancel={onRenameCancel}
            />
          ) : showTooltip ? (
            <Tooltip label={rawName} placement="right">
              <span className="ptree-label">{mappedName}</span>
            </Tooltip>
          ) : (
            <span className="ptree-label">{mappedName}</span>
          )}
        </div>
        {isExpanded && entry.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
            selectedPath={selectedPath}
            onSelect={onSelect}
            dirtyPaths={dirtyPaths}
            onContextMenu={onContextMenu}
            renamingPath={renamingPath}
            onRenameConfirm={onRenameConfirm}
            onRenameCancel={onRenameCancel}
            creatingIn={creatingIn}
            creatingType={creatingType}
            onCreateConfirm={onCreateConfirm}
            onCreateCancel={onCreateCancel}
            displayNameMap={displayNameMap}
          />
        ))}
        {isExpanded && isCreatingHere && (
          <div className="ptree-node ptree-file" style={{ paddingLeft: paddingLeft + 16 }}>
            <span className="material-symbols-outlined ptree-icon" aria-hidden="true">
              {creatingType === 'folder' ? 'folder' : 'draft'}
            </span>
            <InlineInput
              defaultValue=""
              onConfirm={onCreateConfirm}
              onCancel={onCreateCancel}
            />
          </div>
        )}
        {isExpanded && !isCreatingHere && entry.children?.length === 0 && (
          <div className="ptree-node ptree-empty" style={{ paddingLeft: paddingLeft + 16 }}>
            <span className="ptree-label ptree-label-muted">(empty)</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`ptree-node ptree-file${isSelected ? ' is-active' : ''}`}
      style={{ paddingLeft }}
      onClick={() => onSelect(entry)}
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      <span className="material-symbols-outlined ptree-icon" aria-hidden="true">
        {getFileIcon(entry.name, false, false)}
      </span>
      {isRenaming ? (
        <InlineInput
          defaultValue={entry.name}
          onConfirm={(v) => onRenameConfirm(entry.path, v)}
          onCancel={onRenameCancel}
        />
      ) : showTooltip ? (
        <Tooltip label={rawName} placement="right">
          <span className="ptree-label">{mappedName}</span>
        </Tooltip>
      ) : (
        <span className="ptree-label">{mappedName}</span>
      )}
      {isDirty && !isRenaming && <span className="ptree-dirty-dot" aria-label="unsaved">●</span>}
    </div>
  );
}

/* ── ProjectTree ── */

export function ProjectTree() {
  const { currentProject, resolvedLocale, openFile, openFiles } = useAppStore(
    useShallow((s) => ({
      currentProject: s.currentProject,
      resolvedLocale: s.resolvedLocale,
      openFile: s.openFile,
      openFiles: s.openFiles,
    })),
  );

  const { t } = useI18n(resolvedLocale);

  const displayNameMap = useMemo<Record<string, string>>(() => ({
    'chapters': t('projectTree.chapters'),
    'scenes': t('projectTree.scenes'),
    'assets': t('projectTree.assetsDir'),
    'project.yaml': t('projectTree.projectConfig'),
  }), [t]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [fileTree, setFileTree] = useState<FileEntry[] | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxState>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);

  const activeFilePath = useAppStore((s) => s.activeFilePath);

  const dirtyPaths = new Set(
    openFiles.filter((f) => f.content !== f.savedContent).map((f) => f.path),
  );

  // 懒初始化文件树
  if (!fileTree && currentProject) {
    setFileTree(buildInitialTree(currentProject.name));
  }

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const handleSelect = useCallback((entry: FileEntry) => {
    const content = mockFileContents[entry.path] ?? '';
    openFile(entry.path, entry.name, content);
  }, [openFile]);

  /* ── Context menu ── */

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const ctxItems: ContextMenuItem[] = (() => {
    if (!ctxMenu) return [];
    const { entry } = ctxMenu;
    const items: ContextMenuItem[] = [];

    // Blank area right-click: create at project root
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

    // Root node cannot be renamed or deleted
    if (entry.path !== '/') {
      items.push({
        type: 'item', label: t('contextMenu.rename'), icon: 'edit',
        onClick: () => setRenamingPath(entry.path),
      });
      items.push({
        type: 'item', label: t('contextMenu.delete'), icon: 'delete', danger: true,
        onClick: () => {
          setFileTree((prev) => prev ? removeNode(prev, entry.path) : prev);
        },
      });
      items.push({ type: 'separator' });
    }

    items.push({
      type: 'item', label: t('contextMenu.openInExplorer'), icon: 'folder_open',
      onClick: () => {
        const dir = currentProject?.path;
        if (dir) {
          const fullPath = entry.path === '/' ? dir : `${dir}${entry.path}`;
          if (entry.isDir) {
            window.orisonDesktop?.openPath(fullPath);
          } else {
            window.orisonDesktop?.showItemInFolder(fullPath);
          }
        }
      },
    });

    return items;
  })();

  /* ── Rename ── */

  const handleRenameConfirm = useCallback((oldPath: string, newName: string) => {
    setFileTree((prev) => prev ? renameNode(prev, oldPath, newName) : prev);
    setRenamingPath(null);
  }, []);

  const handleRenameCancel = useCallback(() => setRenamingPath(null), []);

  /* ── Create ── */

  const handleCreateConfirm = useCallback((name: string) => {
    if (!creatingIn || !creatingType) return;
    const isDir = creatingType === 'folder';
    const newPath = creatingIn === '/' ? `/${name}` : `${creatingIn}/${name}`;
    const child: FileEntry = { name, path: newPath, isDir, children: isDir ? [] : undefined };
    setFileTree((prev) => prev ? insertChild(prev, creatingIn, child) : prev);
    setCreatingIn(null);
    setCreatingType(null);
  }, [creatingIn, creatingType]);

  const handleCreateCancel = useCallback(() => {
    setCreatingIn(null);
    setCreatingType(null);
  }, []);

  /* ── Render ── */

  if (!currentProject || !fileTree) return null;

  return (
    <aside className="project-tree-panel" aria-label="Project Files">
      <div className="ptree-header">
        <span className="ptree-header-title">{t('projectTree.title')}</span>
      </div>
      <div
        className="ptree-list"
        onContextMenu={(e) => {
          // Only fires on blank area; node handlers call stopPropagation
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY, entry: null });
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
            onRenameCancel={handleRenameCancel}
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
