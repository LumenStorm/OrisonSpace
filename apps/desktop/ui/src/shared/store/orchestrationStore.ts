import { create } from 'zustand';
import type { z } from 'zod';
import type { orchestrationRunSchema } from '@orison/shared-contracts';

type RunSnapshot = z.infer<typeof orchestrationRunSchema>;

type OrchestrationState = {
  run: RunSnapshot | null;
  loading: boolean;
  error: string | null;
  startRun: () => Promise<void>;
  refreshRun: () => Promise<void>;
};

export const useOrchestrationStore = create<OrchestrationState>((set) => ({
  run: null,
  loading: false,
  error: null,
  async startRun() {
    set({ loading: true, error: null });
    try {
      set({
        run: {
          runId: 'run_local_preview',
          status: 'pending',
          currentNodeId: null,
          projectPath: 'local-preview',
          completedNodes: [],
          pendingNodes: [
            'intake-agent',
            'asset-loader-agent',
            'story-planner-agent',
            'chapter-task-agent',
            'draft-writer-agent',
            'continuity-memory-agent',
            'multi-review-agent'
          ],
          artifacts: {},
          review: null,
          archive: null
        },
        loading: false
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error', loading: false });
    }
  },
  async refreshRun() {
    set((state) => ({ ...state }));
  }
}));
