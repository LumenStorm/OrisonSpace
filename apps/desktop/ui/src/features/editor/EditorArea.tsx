import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';
import { FileEditor } from './FileEditor';
import { FileTabBar } from './FileTabBar';
import { ModuleEditor } from './ModuleEditor';

const moduleAlwaysOwnsEditor = new Set<WorkspaceModule>(['image_gen', 'video', 'storyboard', 'guided_novel']);

export function EditorArea() {
  const activeModule = useAppStore((state) => state.activeModule);
  const activeFilePath = useAppStore((state) => state.activeFilePath);
  const hasOpenFiles = useAppStore((state) => state.openFiles.length > 0);

  if (moduleAlwaysOwnsEditor.has(activeModule)) {
    return <ModuleEditor />;
  }

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
