import { useAppStore } from '../../shared/store/appStore';
import { GuidedNovelWorkspace } from '../guided-novel/GuidedNovelWorkspace';
import { NovelHome } from '../novel-home/NovelHome';
import { NovelScriptWithCreative } from '../editor/NovelScriptWithCreative';
import { ScriptEditor } from '../editor/ScriptEditor';

export function NovelWorkspaceRouter() {
  const route = useAppStore((s) => s.novelWorkspace.route);

  if (route === 'home') {
    return <NovelHome />;
  }

  if (route === 'guided') {
    return <GuidedNovelWorkspace />;
  }

  return <NovelScriptWithCreative ContentEditor={ScriptEditor} />;
}
