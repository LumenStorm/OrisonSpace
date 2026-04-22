import { create } from 'zustand';
import type { z } from 'zod';
import type { taskRequestSchema, taskResultSchema, patchOperationSchema } from '@orison/shared-contracts';

export type WorkspaceModule = 'story' | 'script' | 'storyboard' | 'video';
type TaskRequest = z.infer<typeof taskRequestSchema>;
type TaskResult = z.infer<typeof taskResultSchema>;
type PatchOperation = z.infer<typeof patchOperationSchema>;

export type TaskAdapter = {
  submitTask: (request: TaskRequest) => Promise<{ taskId: string; status: string }>;
  getTaskResult: (taskId: string) => Promise<TaskResult>;
};

type TaskEntry = {
  request: TaskRequest;
  result: TaskResult | null;
};

type AppState = {
  activeModule: WorkspaceModule;
  setActiveModule: (module: WorkspaceModule) => void;

  taskAdapter: TaskAdapter | null;
  setTaskAdapter: (adapter: TaskAdapter) => void;

  currentTask: TaskEntry | null;
  submitRewrite: (instruction: string) => Promise<void>;
  acceptTaskResult: () => void;

  acceptedPatches: PatchOperation[];
};

export const useAppStore = create<AppState>((set, get) => ({
  activeModule: 'storyboard',
  setActiveModule: (activeModule) => set({ activeModule }),

  taskAdapter: null,
  setTaskAdapter: (adapter) => set({ taskAdapter: adapter }),

  currentTask: null,

  async submitRewrite(instruction: string) {
    const adapter = get().taskAdapter;
    if (!adapter) return;

    const request: TaskRequest = {
      taskId: `task_${Date.now()}`,
      taskType: 'story.rewrite',
      projectFingerprint: 'local_project',
      selectedScope: { module: 'story', entityId: 'act_1' },
      contextPayload: { story: { title: 'Current Story' } },
      userInstruction: instruction,
      privacyLevel: 'minimal',
      expectedOutputType: 'patch'
    };

    const { taskId } = await adapter.submitTask(request);
    set({ currentTask: { request, result: null } });

    const poll = async () => {
      const result = await adapter.getTaskResult(taskId);
      set({ currentTask: { request, result } });
      if (result.status !== 'completed' && result.status !== 'failed') {
        await new Promise((r) => setTimeout(r, 100));
        return poll();
      }
    };
    await poll();
  },

  acceptTaskResult() {
    const task = get().currentTask;
    if (!task?.result?.outputPayload?.operations) return;

    set({
      acceptedPatches: [
        ...get().acceptedPatches,
        ...task.result.outputPayload.operations
      ],
      currentTask: null
    });
  },

  acceptedPatches: []
}));
