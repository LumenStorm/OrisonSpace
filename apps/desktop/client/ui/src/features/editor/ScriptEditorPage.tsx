import { ScriptEditor } from './ScriptEditor';
import { AcceptedPatchesView } from './AcceptedPatchesView';
import { EditorStatusBar } from './EditorStatusBar';

export function ScriptEditorPage() {
  return (
    <>
      <AcceptedPatchesView />
      <ScriptEditor />
      <EditorStatusBar />
    </>
  );
}
