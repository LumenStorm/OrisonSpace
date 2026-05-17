import { useAppStore } from '../../shared/store/appStore';
import { ImageGenEditor } from './ImageGenEditor';
import { ScriptEditor } from './ScriptEditor';
import { StoryboardCanvas } from './StoryboardCanvas';
import { VideoEditor } from './VideoEditor';
import { AcceptedPatchesView } from './AcceptedPatchesView';
import { NovelScriptWithCreative } from './NovelScriptWithCreative';

const simpleEditors = {
  storyboard: StoryboardCanvas,
  video: VideoEditor,
  image_gen: ImageGenEditor,
} as const;

export function ModuleEditor() {
  const activeModule = useAppStore((state) => state.activeModule);

  if (activeModule === 'novel' || activeModule === 'script') {
    return (
      <>
        <AcceptedPatchesView />
        <NovelScriptWithCreative ContentEditor={ScriptEditor} />
      </>
    );
  }

  const Editor = simpleEditors[activeModule as keyof typeof simpleEditors];
  if (!Editor) return null;

  return (
    <>
      <AcceptedPatchesView />
      <Editor />
    </>
  );
}
