import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useToastStore } from '../store/toastStore';
import { translate } from '../i18n/useI18n';

export function useCloseGuard() {
  useEffect(() => {
    const api = (window as any).orisonDesktop;
    if (!api?.onBeforeClose) return;

    const unsubscribe = api.onBeforeClose(async () => {
      const state = useAppStore.getState();
      const t = (key: string, vars?: Record<string, string | number>) =>
        translate(state.resolvedLocale, key, vars);
      if (!state.hasDirtyFiles()) {
        api.confirmClose();
        return;
      }
      try {
        const { failed } = await state.saveAllOpenFiles();
        if (failed.length > 0) {
          // A save failed (disk full, permission, file locked). Do NOT close —
          // closing would discard the unsaved buffer. Keep the window open and
          // let the user resolve it. Ask whether to force-close anyway.
          const names = failed.map((p) => p.split(/[\\/]/).pop()).join(', ');
          if (window.confirm(t('fileEditor.saveFailedOnClose', { names }))) {
            api.confirmClose();
          } else {
            useToastStore.getState().showToast(t('fileEditor.saveFailedToast', { names }), 'error');
          }
          return;
        }
        api.confirmClose();
      } catch {
        // Saving threw unexpectedly — surface it and keep the window open rather
        // than closing over unsaved work. The user can retry or force-quit.
        useToastStore.getState().showToast(t('fileEditor.saveFailedToast', { names: '' }), 'error');
      }
    });

    return unsubscribe;
  }, []);
}
