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
    });

    return unsubscribe;
  }, []);
}
