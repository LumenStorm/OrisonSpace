import { useAppStore } from '../../shared/store/appStore';
import { ImageGenEditor } from './ImageGenEditor';
import { OutlineEditor } from './OutlineEditor';
import { ScriptEditor } from './ScriptEditor';
import { StoryboardCanvas } from './StoryboardCanvas';
import { VideoEditor } from './VideoEditor';
import { AcceptedPatchesView } from './AcceptedPatchesView';
import { NovelScriptWithCreative } from './NovelScriptWithCreative';
import { NovelWorkspaceRouter } from '../novel-workspace/NovelWorkspaceRouter';

const simpleEditors = {
  outline: OutlineEditor,
  storyboard: StoryboardCanvas,
  video: VideoEditor,
  image_gen: ImageGenEditor,
} as const;

export function ModuleEditor() {
  const activeModule = useAppStore((state) => state.activeModule);
  const currentProject = useAppStore((state) => state.currentProject);

  if (currentProject?.type === 'novel' && (activeModule === 'novel' || activeModule === 'script' || activeModule === 'guided_novel')) {
    return <NovelWorkspaceRouter />;
  }

  if (activeModule === 'novel' || activeModule === 'script') {
    return (
      <>
        <AcceptedPatchesView />
        <NovelScriptWithCreative ContentEditor={ScriptEditor} />
      </>
    );
  }

  const Editor = activeModule in simpleEditors
    ? simpleEditors[activeModule as keyof typeof simpleEditors]
    : OutlineEditor;

  return (
    <>
      <AcceptedPatchesView />
      <Editor />
    </>
  );
}
