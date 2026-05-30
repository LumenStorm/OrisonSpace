import type { RunResult } from './runService';
import { getRun } from './runStore';

export function createActionService() {
  return {
    async acceptCurrent(runId: string): Promise<RunResult> {
      const run = getRun(runId);
      if (!run) throw new Error(`Run ${runId} not found`);
      if (run.status !== 'human_in_loop') throw new Error(`Run ${runId} not awaiting action`);

      run.status = 'delivered';
      run.archive = { versionId: `ver_${Date.now().toString(36)}` };
      run.delivery = { deliveryId: `dlv_${Date.now().toString(36)}` };
      run.feedback = { feedbackId: `fb_${Date.now().toString(36)}` };
      run.currentNodeId = null;
      return run;
    },

    async abortRun(runId: string): Promise<RunResult> {
      const run = getRun(runId);
      if (!run) throw new Error(`Run ${runId} not found`);

      run.status = 'failed';
      run.review = { ...(run.review ?? {}), reasons: [...(run.review?.reasons ?? []), 'user_abort'] };
      run.currentNodeId = null;
      return run;
    },
  };
}
