import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useCloseGuard() {
  useEffect(() => {
    const api = (window as any).orisonDesktop;
    if (!api?.onBeforeClose) return;

    const unsubscribe = api.onBeforeClose(() => {
      const hasDirty = useAppStore.getState().hasDirtyFiles();
      if (!hasDirty) {
        api.confirmClose();
        return;
      }
      useAppStore.getState().saveAllOpenFiles().then(() => {
        api.confirmClose();
      });
    });

    return unsubscribe;
  }, []);
}
