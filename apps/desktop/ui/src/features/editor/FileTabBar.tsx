import { useAppStore } from '../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';

function getTabIcon(name: string): string {
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'data_object';
  if (name.endsWith('.md')) return 'article';
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.webp')) return 'image';
  return 'draft';
}

export function FileTabBar() {
  const { openFiles, activeFilePath, closeFile } = useAppStore(
    useShallow((s) => ({
      openFiles: s.openFiles,
      activeFilePath: s.activeFilePath,
      closeFile: s.closeFile,
    })),
  );
  const openFile = useAppStore((s) => s.openFile);

  if (openFiles.length === 0) return null;

  return (
    <nav className="file-tab-bar" aria-label="Open files">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        const isDirty = file.content !== file.savedContent;
        return (
          <div
            key={file.path}
            className={`file-tab${isActive ? ' file-tab-active' : ''}`}
            onClick={() => openFile(file.path, file.name, file.content)}
          >
            <span className="material-symbols-outlined file-tab-icon" aria-hidden="true">
              {getTabIcon(file.name)}
            </span>
            <span className="file-tab-name">{file.name}</span>
            {isDirty && <span className="file-tab-dirty" aria-label="unsaved">●</span>}
            <button
              type="button"
              className="file-tab-close"
              aria-label={`Close ${file.name}`}
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
