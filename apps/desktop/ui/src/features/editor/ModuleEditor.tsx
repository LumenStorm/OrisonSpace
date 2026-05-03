import { useAppStore } from '../../shared/store/appStore';
import { ImageGenEditor } from './ImageGenEditor';
import { OutlineEditor } from './OutlineEditor';
import { ScriptEditor } from './ScriptEditor';
import { StoryboardCanvas } from './StoryboardCanvas';
import { VideoEditor } from './VideoEditor';
import { AcceptedPatchesView } from './AcceptedPatchesView';
import { NovelScriptWithCreative } from './NovelScriptWithCreative';

const simpleEditors = {
  outline: OutlineEditor,
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

  const Editor = simpleEditors[activeModule];

  return (
    <>
      <AcceptedPatchesView />
      <Editor />
    </>
  );
}
