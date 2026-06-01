import { useAppStore } from '../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { FileEditor } from './FileEditor';
import { FileTabBar } from './FileTabBar';
import { ModuleEditor } from './ModuleEditor';
import { SplitFileEditor } from './SplitFileEditor';
import { DocOutline } from './DocOutline';
import { Minimap } from './Minimap';

export function EditorArea() {
  const { activeFilePath, hasOpenFiles, splitDirection, splitFilePath, activeFileContent, showMinimap } = useAppStore(useShallow((s) => ({
    activeFilePath: s.activeFilePath,
    hasOpenFiles: s.openFiles.length > 0,
    splitDirection: s.splitDirection,
    splitFilePath: s.splitFilePath,
    activeFileContent: s.openFiles.find((f) => f.path === s.activeFilePath)?.content ?? '',
    showMinimap: s.showMinimap,
  })));

  if (hasOpenFiles) {
    const showSplit = splitDirection !== 'none' && splitDirection !== 'outline' && splitFilePath;
    const showOutline = splitDirection === 'outline';
    return (
      <div className="editor-area-file">
        <FileTabBar />
        <div className={`editor-area-file-content${showSplit ? ` editor-split editor-split--${splitDirection}` : ''}${showOutline ? ' editor-split editor-split--outline' : ''}`}>
          {activeFilePath ? <FileEditor /> : null}
          {showSplit && <SplitFileEditor filePath={splitFilePath} />}
          {showOutline && <DocOutline content={activeFileContent} />}
          {showMinimap && <Minimap />}
        </div>
      </div>
    );
  }

  return <ModuleEditor />;
}
