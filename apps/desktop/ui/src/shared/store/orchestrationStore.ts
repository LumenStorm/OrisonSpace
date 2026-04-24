import { create } from 'zustand';
import type { z } from 'zod';
import type { orchestrationRunSchema, orchestrationActionSchema } from '@orison/shared-contracts';

type RunSnapshot = z.infer<typeof orchestrationRunSchema>;
type OrchestrationAction = z.infer<typeof orchestrationActionSchema>;

const API_BASE = 'http://localhost:4000';

type OrchestrationState = {
  run: RunSnapshot | null;
  loading: boolean;
  error: string | null;
  startRun: (projectPath: string, requirement: string) => Promise<void>;
  refreshRun: () => Promise<void>;
  performAction: (action: Omit<OrchestrationAction, 'runId'>) => Promise<void>;
};

export const useOrchestrationStore = create<OrchestrationState>((set, get) => ({
  run: null,
  loading: false,
  error: null,

  async startRun(projectPath: string, requirement: string) {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/v1/orchestration/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, requirement })
      });
      if (!res.ok) throw new Error(`启动失败: ${res.status}`);
      const run = await res.json() as RunSnapshot;
      set({ run, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '未知错误', loading: false });
    }
  },

  async refreshRun() {
    const { run } = get();
    if (!run) return;
    try {
      const res = await fetch(`${API_BASE}/v1/orchestration/runs/${encodeURIComponent(run.runId)}`);
      if (!res.ok) throw new Error(`刷新失败: ${res.status}`);
      const updated = await res.json() as RunSnapshot;
      set({ run: updated });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '未知错误' });
    }
  },

  async performAction(action) {
    const { run } = get();
    if (!run) return;
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/v1/orchestration/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.runId, ...action })
      });
      if (!res.ok) throw new Error(`操作失败: ${res.status}`);
      const updated = await res.json() as RunSnapshot;
      set({ run: updated, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '未知错误', loading: false });
    }
  }
}));
