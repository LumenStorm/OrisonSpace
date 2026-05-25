import type { StateCreator } from 'zustand';
import type { TaskAdapter, TaskEntry, TaskRequest, PatchOperation } from './types';

export type TasksSlice = {
  taskAdapter: TaskAdapter | null;
  setTaskAdapter: (adapter: TaskAdapter) => void;
  currentTask: TaskEntry | null;
  submitRewrite: (instruction: string) => Promise<void>;
  cancelPolling: () => void;
  acceptTaskResult: () => void;
  acceptedPatches: PatchOperation[];
};

export const createTasksSlice: StateCreator<
  TasksSlice & { currentProject: { projectId?: string } | null },
  [],
  [],
  TasksSlice
> = (set, get) => {
  let abortController: AbortController | null = null;

  return {
    taskAdapter: null,
    setTaskAdapter: (adapter) => set({ taskAdapter: adapter }),
    currentTask: null,
    acceptedPatches: [],

    cancelPolling() {
      abortController?.abort();
      abortController = null;
    },

    async submitRewrite(instruction: string) {
      const adapter = get().taskAdapter;
      const currentProject = get().currentProject;
      if (!adapter || !currentProject?.projectId) return;

      abortController?.abort();
      abortController = new AbortController();
      const signal = abortController.signal;

      const request: TaskRequest = {
        projectId: currentProject.projectId,
        targetId: 'act_1',
        assetIds: [],
        type: 'outline.rewrite',
        name: 'Rewrite Current Passage',
        description: instruction,
        input: instruction
      };

      const { taskId } = await adapter.submitTask(request);
      set({ currentTask: { request, result: null } });

      const poll = async () => {
        if (signal.aborted) return;
        const result = await adapter.getTaskResult(taskId);
        if (signal.aborted) return;
        set({ currentTask: { request, result } });
        if (result.status !== 'completed' && result.status !== 'failed') {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (!signal.aborted) return poll();
        }
      };

      try {
        await poll();
      } finally {
        if (abortController?.signal === signal) {
          abortController = null;
        }
      }
    },

    acceptTaskResult() {
      const task = get().currentTask;
      if (!task?.result?.outputPayload?.operations) return;

      set({
        acceptedPatches: [
          ...get().acceptedPatches,
          ...task.result.outputPayload.operations,
        ],
        currentTask: null,
      });
    },
  };
};
