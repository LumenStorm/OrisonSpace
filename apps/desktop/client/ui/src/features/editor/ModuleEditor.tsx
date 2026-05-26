import { ScriptEditor } from './ScriptEditor';
import { AcceptedPatchesView } from './AcceptedPatchesView';

export function ModuleEditor() {
  return (
    <>
      <AcceptedPatchesView />
      <ScriptEditor />
    </>
  );
}
