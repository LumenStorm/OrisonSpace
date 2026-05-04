import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';

export function useProjectTreeResize() {
  const setProjectTreeWidth = useAppStore((s) => s.setProjectTreeWidth);
  return useCallback(
    (delta: number) => {
      const w = useAppStore.getState().projectTreeWidth;
      setProjectTreeWidth(w + delta);
    },
    [setProjectTreeWidth],
  );
}

export function useBottomPanelResize() {
  const setBottomPanelHeight = useAppStore((s) => s.setBottomPanelHeight);
  return useCallback(
    (delta: number) => {
      const h = useAppStore.getState().bottomPanelHeight;
      setBottomPanelHeight(h - delta);
    },
    [setBottomPanelHeight],
  );
}
