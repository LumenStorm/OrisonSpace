import { useState } from 'react';
import { Tooltip } from '../../shared/components/Tooltip';
import { InlineInput } from './InlineInput';
import type { CreatingType, FileEntry } from './types';
import { getDisplayName, getFileIcon } from './treeUtils';

type FileTreeNodeProps = {
  entry: FileEntry;
  depth?: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (entry: FileEntry) => void;
  dirtyPaths: Set<string>;
  onContextMenu: (event: React.MouseEvent, entry: FileEntry) => void;
  renamingPath: string | null;
  onRenameConfirm: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
  creatingIn: string | null;
  creatingType: CreatingType;
  onCreateConfirm: (name: string) => void;
  onCreateCancel: () => void;
  displayNameMap: Record<string, string>;
  onDropToFolder: (event: React.DragEvent, folderPath: string) => void;
  t: (key: string) => string;
};

export function FileTreeNode({
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
  onDropToFolder,
  t,
}: FileTreeNodeProps) {
  const paddingLeft = 8 + depth * 16;
  const isExpanded = expandedPaths.has(entry.path);
  const isSelected = entry.path === selectedPath;
  const isDirty = dirtyPaths.has(entry.path);
  const isRenaming = renamingPath === entry.path;
  const isCreatingHere = creatingIn === entry.path;
  const [isDropHover, setIsDropHover] = useState(false);

  const rawName = getDisplayName(entry.name);
  const mappedName = displayNameMap[entry.name] ?? rawName;
  const showTooltip = mappedName !== rawName;

  if (entry.isDir) {
    return (
      <div className="ptree-group" role="treeitem" aria-expanded={isExpanded} aria-selected={isSelected}>
        <div
          className={`ptree-node ptree-folder${isSelected ? ' is-active' : ''}${isDropHover ? ' is-drop-target' : ''}`}
          style={{ paddingLeft }}
          tabIndex={0}
          onClick={() => onToggle(entry.path)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggle(entry.path);
            }
          }}
          onContextMenu={(event) => onContextMenu(event, entry)}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDropHover(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(event) => {
            event.stopPropagation();
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDropHover(false);
            }
          }}
          onDrop={(event) => {
            setIsDropHover(false);
            onDropToFolder(event, entry.path);
          }}
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
              onConfirm={(value) => onRenameConfirm(entry.path, value)}
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
        <div className={`ptree-children${isExpanded ? ' is-open' : ''}`} role="group">
          <div className="ptree-children-inner">
            {entry.children?.map((child) => (
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
                onDropToFolder={onDropToFolder}
                t={t}
              />
            ))}
            {isCreatingHere && (
              <div className="ptree-node ptree-file" style={{ paddingLeft: paddingLeft + 16 }}>
                <span className="material-symbols-outlined ptree-icon" aria-hidden="true">
                  {creatingType === 'folder' ? 'folder' : 'draft'}
                </span>
                <InlineInput defaultValue="" onConfirm={onCreateConfirm} onCancel={onCreateCancel} />
              </div>
            )}
            {!isCreatingHere && entry.children?.length === 0 && (
              <div className="ptree-node ptree-empty" style={{ paddingLeft: paddingLeft + 16 }}>
                <span className="ptree-label ptree-label-muted">{t('projectTree.empty')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`ptree-node ptree-file${isSelected ? ' is-active' : ''}`}
      style={{ paddingLeft }}
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={() => onSelect(entry)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(entry);
        }
      }}
      onContextMenu={(event) => onContextMenu(event, entry)}
    >
      <span className="material-symbols-outlined ptree-icon" aria-hidden="true">
        {getFileIcon(entry.name, false, false)}
      </span>
      {isRenaming ? (
        <InlineInput
          defaultValue={entry.name}
          onConfirm={(value) => onRenameConfirm(entry.path, value)}
          onCancel={onRenameCancel}
        />
      ) : showTooltip ? (
        <Tooltip label={rawName} placement="right">
          <span className="ptree-label">{mappedName}</span>
        </Tooltip>
      ) : (
        <span className="ptree-label">{mappedName}</span>
      )}
      {isDirty && !isRenaming && <span className="ptree-dirty-dot" aria-label={t('projectTree.unsaved')}>•</span>}
    </div>
  );
}
