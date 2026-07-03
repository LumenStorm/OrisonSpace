import { useAppStore } from '../../shared/store/appStore';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';
import { normalizePath } from '../../shared/utils/paths';

/**
 * Open a chapter's manuscript file as a tab (the source of truth). Given no
 * chapter, opens the most recently edited one. Falls back to the outline page
 * when the project has no chapters yet or the file can't be read, so the
 * "writing" entry point always lands somewhere useful instead of a dead editor.
 *
 * Shared by the overview "Continue writing" action and the side-nav writing
 * entry so both drive the exact same file-editor flow.
 */
export async function openWriting(chapter?: NovelChapterMeta): Promise<void> {
  const state = useAppStore.getState();
  const projectPath = state.currentProject?.path;
  const chapters = state.novelChapters as NovelChapterMeta[];
  const recent = [...chapters].sort((a, b) => b.sortOrder - a.sortOrder);
  const target = chapter ?? recent[0];
  const contentFile = target?.sections?.[0]?.contentFile;
  if (!projectPath || !target || !contentFile) {
    state.setActivePage('outline');
    return;
  }
  const filePath = `${normalizePath(projectPath)}/${contentFile}`;
  const name = contentFile.slice(contentFile.lastIndexOf('/') + 1);
  try {
    const content = await window.orisonDesktop?.readFile(filePath);
    state.openFile(filePath, name, content ?? '');
  } catch {
    state.setActivePage('outline');
  }
}
