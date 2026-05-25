import { useAppStore } from '../../shared/store/appStore';
import { ScriptEditor } from './ScriptEditor';
import { AcceptedPatchesView } from './AcceptedPatchesView';
import { NovelScriptWithCreative } from './NovelScriptWithCreative';

/** @deprecated Use ScriptEditorPage instead */
export function ModuleEditor() {
  const activePage = useAppStore((state) => state.activePage);

  if (activePage === 'novel' || activePage === 'script') {
    return (
      <>
        <AcceptedPatchesView />
        <NovelScriptWithCreative ContentEditor={ScriptEditor} />
      </>
    );
  }

  return null;
}
