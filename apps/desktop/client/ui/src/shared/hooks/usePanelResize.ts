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

function _useBottomPanelResize() {
  const setBottomPanelHeight = useAppStore((s) => s.setBottomPanelHeight);
  return useCallback(
    (delta: number) => {
      const h = useAppStore.getState().bottomPanelHeight;
      setBottomPanelHeight(h - delta);
    },
    [setBottomPanelHeight],
  );
}

export function useAgentPanelResize() {
  const setAgentPanelWidth = useAppStore((s) => s.setAgentPanelWidth);
  return useCallback(
    (delta: number) => {
      const w = useAppStore.getState().agentPanelWidth;
      setAgentPanelWidth(w - delta);
    },
    [setAgentPanelWidth],
  );
}
