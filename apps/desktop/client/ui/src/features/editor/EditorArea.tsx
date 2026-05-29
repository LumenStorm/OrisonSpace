import { useAppStore } from '../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { FileEditor } from './FileEditor';
import { FileTabBar } from './FileTabBar';
import { ModuleEditor } from './ModuleEditor';
import { SplitFileEditor } from './SplitFileEditor';

export function EditorArea() {
  const { activeFilePath, hasOpenFiles, splitDirection, splitFilePath } = useAppStore(useShallow((s) => ({
    activeFilePath: s.activeFilePath,
    hasOpenFiles: s.openFiles.length > 0,
    splitDirection: s.splitDirection,
    splitFilePath: s.splitFilePath,
  })));

  if (hasOpenFiles) {
    const showSplit = splitDirection !== 'none' && splitFilePath;
    return (
      <div className="editor-area-file">
        <FileTabBar />
        <div className={`editor-area-file-content${showSplit ? ` editor-split editor-split--${splitDirection}` : ''}`}>
          {activeFilePath ? <FileEditor /> : null}
          {showSplit && <SplitFileEditor filePath={splitFilePath} />}
        </div>
      </div>
    );
  }

  return <ModuleEditor />;
}
