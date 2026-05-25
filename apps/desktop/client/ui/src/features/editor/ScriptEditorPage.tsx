import { ScriptEditor } from './ScriptEditor';
import { AcceptedPatchesView } from './AcceptedPatchesView';
import { NovelScriptWithCreative } from './NovelScriptWithCreative';

export function ScriptEditorPage() {
  return (
    <>
      <AcceptedPatchesView />
      <NovelScriptWithCreative ContentEditor={ScriptEditor} />
    </>
  );
}
