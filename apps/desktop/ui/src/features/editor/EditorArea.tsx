import { useAppStore } from '../../shared/store/appStore';
import { FileEditor } from './FileEditor';
import { FileTabBar } from './FileTabBar';
import { ModuleEditor } from './ModuleEditor';
import { ImageGenEditor } from './ImageGenEditor';
import { StoryboardCanvas } from './StoryboardCanvas';
import { VideoEditor } from './VideoEditor';

const moduleEditorMap: Record<string, React.ComponentType> = {
  image_gen: ImageGenEditor,
  storyboard: StoryboardCanvas,
  video: VideoEditor,
};

export function EditorArea() {
  const activeFilePath = useAppStore((state) => state.activeFilePath);
  const hasOpenFiles = useAppStore((state) => state.openFiles.length > 0);

  if (hasOpenFiles) {
    return (
      <div className="editor-area-file">
        <FileTabBar />
        <div className="editor-area-file-content">
          {activeFilePath?.startsWith('__module__/') ? (
            <ModuleTabContent moduleId={activeFilePath.replace('__module__/', '')} />
          ) : activeFilePath ? (
            <FileEditor />
          ) : null}
        </div>
      </div>
    );
  }

  return <ModuleEditor />;
}

function ModuleTabContent({ moduleId }: { moduleId: string }) {
  const Editor = moduleEditorMap[moduleId];
  if (!Editor) return null;
  return <Editor />;
}
