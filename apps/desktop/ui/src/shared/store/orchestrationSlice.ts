import type { StateCreator } from 'zustand';
import type { z } from 'zod';
import type { projectFieldPatchSchema } from '@orison/shared-contracts';
import { projectFieldPatchSchema as patchSchema } from '@orison/shared-contracts';
import {
  fetchOrchestrationRun,
  performOrchestrationAction,
  startOrchestrationRun,
  type OrchestrationAction,
  type RunSnapshot,
} from '../api/orchestration';

type ProjectFieldPatch = z.infer<typeof projectFieldPatchSchema>;

const ERROR_KEY_START = 'orchestration.startFailed';
const ERROR_KEY_REFRESH = 'orchestration.refreshFailed';
const ERROR_KEY_ACTION = 'orchestration.actionFailed';
const ERROR_KEY_UNKNOWN = 'orchestration.unknownError';

function statusFromMessage(message: string, prefix: string): string {
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function makeErrorKey(error: unknown, fallbackKey: string, prefix: string): string {
  if (error instanceof Error && error.message.startsWith(prefix)) {
    return `${fallbackKey}|${statusFromMessage(error.message, prefix)}`;
  }
  return error instanceof Error ? error.message : ERROR_KEY_UNKNOWN;
}

export type OrchestrationSlice = {
  orchestrationRun: RunSnapshot | null;
  orchestrationLoading: boolean;
  orchestrationError: string | null;
  startOrchestrationRun: (projectPath: string, requirement: string) => Promise<void>;
  refreshOrchestrationRun: () => Promise<void>;
  performOrchestrationAction: (action: Omit<OrchestrationAction, 'runId'>) => Promise<void>;
};

type WithPatchSink = OrchestrationSlice & {
  setPendingPatch: (patch: ProjectFieldPatch) => void;
  autoApplyPatches: boolean;
  togglePatchSelection: (field: string) => void;
  applySelectedPatches: () => void;
};

export const createOrchestrationSlice: StateCreator<
  WithPatchSink,
  [],
  [],
  OrchestrationSlice
> = (set, get) => ({
  orchestrationRun: null,
  orchestrationLoading: false,
  orchestrationError: null,

  async startOrchestrationRun(projectPath, requirement) {
    set({ orchestrationLoading: true, orchestrationError: null });
    try {
      const run = await startOrchestrationRun(projectPath, requirement);
      set({ orchestrationRun: run, orchestrationLoading: false });
    } catch (error) {
      set({
        orchestrationError: makeErrorKey(error, ERROR_KEY_START, 'startOrchestrationRun:'),
        orchestrationLoading: false,
      });
    }
  },

  async refreshOrchestrationRun() {
    const current = get().orchestrationRun;
    if (!current) return;
    try {
      const updated = await fetchOrchestrationRun(current.runId);
      set({ orchestrationRun: updated });

      if (updated.status === 'delivered' && updated.delivery?.content) {
        const result = patchSchema.safeParse(updated.delivery.content);
        if (result.success) {
          const state = get();
          state.setPendingPatch(result.data);
          if (state.autoApplyPatches) {
            for (const entry of result.data.patches) {
              state.togglePatchSelection(entry.field);
            }
            state.applySelectedPatches();
          }
        }
      }
    } catch (error) {
      set({ orchestrationError: makeErrorKey(error, ERROR_KEY_REFRESH, 'fetchOrchestrationRun:') });
    }
  },

  async performOrchestrationAction(action) {
    const current = get().orchestrationRun;
    if (!current) return;
    set({ orchestrationLoading: true, orchestrationError: null });
    try {
      const updated = await performOrchestrationAction(current.runId, action);
      set({ orchestrationRun: updated, orchestrationLoading: false });
    } catch (error) {
      set({
        orchestrationError: makeErrorKey(error, ERROR_KEY_ACTION, 'performOrchestrationAction:'),
        orchestrationLoading: false,
      });
    }
  },
});
