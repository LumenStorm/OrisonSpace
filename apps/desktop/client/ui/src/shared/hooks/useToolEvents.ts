/**
 * useToolEvents — listens for tool execution events pushed from Shell
 * and dispatches a custom DOM event so components can react.
 *
 * Components like ProjectTree can listen to 'orison:tool-event' on window.
 */
import { useEffect } from 'react';

export function useToolEvents() {
  useEffect(() => {
    const api = (window as any).orisonDesktop;
    if (!api?.onToolEvent) return;

    const unsubscribe = api.onToolEvent((event: { type: string; [key: string]: unknown }) => {
      window.dispatchEvent(new CustomEvent('orison:tool-event', { detail: event }));
    });

    return unsubscribe;
  }, []);
}
