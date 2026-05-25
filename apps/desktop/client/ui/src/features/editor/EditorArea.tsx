import { useAppStore } from '../../shared/store/appStore';
import { FileEditor } from './FileEditor';
import { FileTabBar } from './FileTabBar';
import { ModuleEditor } from './ModuleEditor';

export function EditorArea() {
  const activeFilePath = useAppStore((state) => state.activeFilePath);
  const hasOpenFiles = useAppStore((state) => state.openFiles.length > 0);

  if (hasOpenFiles) {
    return (
      <div className="editor-area-file">
        <FileTabBar />
        <div className="editor-area-file-content">
          {activeFilePath ? <FileEditor /> : null}
        </div>
      </div>
    );
  }

  return <ModuleEditor />;
}
