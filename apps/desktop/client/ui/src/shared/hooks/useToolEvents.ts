/**
 * useToolEvents — listens for tool execution events pushed from Shell
 * and dispatches a custom DOM event so components can react.
 * Also handles file:changed events by reloading affected open tabs.
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { normalizePath } from '../utils/paths';

export function useToolEvents() {
  useEffect(() => {
    const api = (window as any).orisonDesktop;
    if (!api?.onToolEvent) return;

    // Coalesce bursts of writes (e.g. auto-mode generating many chapters) into a
    // single project-wide rescan instead of one full scan per file.
    let wordCountTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleWordCountRefresh = () => {
      if (wordCountTimer !== null) clearTimeout(wordCountTimer);
      wordCountTimer = setTimeout(() => {
        wordCountTimer = null;
        void useAppStore.getState().refreshWordCount();
      }, 400);
    };

    const unsubscribe = api.onToolEvent((event: { type: string; [key: string]: unknown }) => {
      window.dispatchEvent(new CustomEvent('orison:tool-event', { detail: event }));

      if (event.type === 'file:changed' && typeof event.path === 'string') {
        const state = useAppStore.getState();
        const projectPath = state.currentProject?.path;
        const fullPath = projectPath
          ? normalizePath(`${projectPath}/${event.path}`)
          : event.path;
        const tab = state.openFiles.find((f) => f.path === fullPath);
        if (tab && tab.content === tab.savedContent) {
          state.reloadFile(fullPath);
        }
      }

      // Any on-disk content change can move the project word count; refresh the
      // aggregate so the overview stays accurate even while it is mounted.
      if (event.type === 'file:changed' || event.type === 'chapter:changed') {
        scheduleWordCountRefresh();
      }
    });

    return () => {
      if (wordCountTimer !== null) clearTimeout(wordCountTimer);
      unsubscribe();
    };
  }, []);
}
