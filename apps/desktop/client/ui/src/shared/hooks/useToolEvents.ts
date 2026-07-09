/**
 * useToolEvents — listens for tool execution events pushed from Shell
 * and dispatches a custom DOM event so components can react.
 * Also handles file:changed events by reloading affected open tabs, and
 * surfaces a conflict when a file changes on disk under unsaved edits.
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { normalizePath } from '../utils/paths';
import { deriveChaptersFromDisk } from '../store/chapterDiskDerivation';

const MARKDOWN_EXT = /\.md$/i;

export function useToolEvents() {
  useEffect(() => {
    const api = (window as any).orisonDesktop;
    if (!api?.onToolEvent) return;

    // Coalesce bursts of writes (e.g. auto-mode generating many chapters) into a
    // single project-wide rescan instead of one full scan per file.
    let wordCountTimer: ReturnType<typeof setTimeout> | null = null;
    let chapterRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleWordCountRefresh = () => {
      if (wordCountTimer !== null) clearTimeout(wordCountTimer);
      wordCountTimer = setTimeout(() => {
        wordCountTimer = null;
        void useAppStore.getState().refreshWordCount();
      }, 400);
    };
    const scheduleChapterRefresh = () => {
      if (chapterRefreshTimer !== null) clearTimeout(chapterRefreshTimer);
      chapterRefreshTimer = setTimeout(() => {
        chapterRefreshTimer = null;
        const state = useAppStore.getState();
        const projectPath = state.currentProject?.path;
        if (!projectPath) return;
        void deriveChaptersFromDisk(projectPath, state.novelChapters)
          .then((chapters) => {
            const latest = useAppStore.getState();
            if (latest.currentProject?.path !== projectPath) return;
            latest.setNovelChapters(chapters);
          })
          .catch(() => {});
      }, 300);
    };

    // Reconcile a single open tab against its on-disk file. Reads the file and
    // compares to the tab's saved content so our OWN writes (disk === saved) are
    // ignored. Genuine external edits: clean tab → silent reload; dirty tab →
    // conflict banner. Missing file → external-delete flag.
    const reconcileTab = async (fullPath: string) => {
      const state = useAppStore.getState();
      const tab = state.openFiles.find((f) => f.path === fullPath);
      if (!tab || tab.kind !== 'text') return;
      let disk: string | null | undefined;
      try {
        disk = await api.readFile(fullPath);
      } catch {
        return;
      }
      if (typeof disk !== 'string') {
        // File no longer readable (deleted/moved). Only flag if the tab has
        // unsaved work worth warning about; otherwise leave it (tree refresh
        // handles the listing) so a transient read race doesn't nag the user.
        if (tab.content !== tab.savedContent) state.markExternalChange(fullPath, 'deleted');
        return;
      }
      if (disk === tab.savedContent) return; // our own write, or no real change
      const isDirty = tab.content !== tab.savedContent;
      if (isDirty) {
        // Don't clobber unsaved edits and don't silently drop the external
        // change — surface a conflict the user resolves (reload / keep mine).
        state.markExternalChange(fullPath, 'changed');
      } else {
        void state.reloadFile(fullPath);
      }
    };

    const unsubscribe = api.onToolEvent((event: { type: string; [key: string]: unknown }) => {
      window.dispatchEvent(new CustomEvent('orison:tool-event', { detail: event }));

      if (event.type === 'file:changed') {
        const state = useAppStore.getState();
        const projectPath = state.currentProject?.path;
        // Prefer the concrete changed-path list; fall back to the single `path`.
        const rels: string[] = Array.isArray(event.paths) && event.paths.length > 0
          ? (event.paths as string[])
          : (typeof event.path === 'string' && event.path ? [event.path as string] : []);
        for (const rel of rels) {
          const fullPath = projectPath ? normalizePath(`${projectPath}/${rel}`) : rel;
          // Only touch files actually open as tabs.
          if (state.openFiles.some((f) => f.path === fullPath)) {
            void reconcileTab(fullPath);
          }
        }
        if (projectPath && rels.some((rel) => isChapterMarkdownPath(rel, projectPath))) {
          scheduleChapterRefresh();
        }
      }

      // Any on-disk content change can move the project word count; refresh the
      // aggregate so the overview stays accurate even while it is mounted.
      if (event.type === 'file:changed' || event.type === 'chapter:changed') {
        scheduleWordCountRefresh();
      }
      if (event.type === 'chapter:changed') {
        scheduleChapterRefresh();
      }
    });

    return () => {
      if (wordCountTimer !== null) clearTimeout(wordCountTimer);
      if (chapterRefreshTimer !== null) clearTimeout(chapterRefreshTimer);
      unsubscribe();
    };
  }, []);
}

function isChapterMarkdownPath(path: string, projectPath: string): boolean {
  const normalized = normalizePath(path);
  const project = normalizePath(projectPath).replace(/\/+$/, '');
  const relative = normalized.startsWith(`${project}/`)
    ? normalized.slice(project.length + 1)
    : normalized.replace(/^\/+/, '');
  return relative.startsWith('chapters/') && MARKDOWN_EXT.test(relative);
}
