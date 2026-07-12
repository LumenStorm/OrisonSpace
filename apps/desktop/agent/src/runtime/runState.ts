import type { WorkflowRunStatus } from '../types';

export interface RunCheckpoint {
  sessionId: string;
  stage: 'loop';
  createdAt: number;
  reason: 'aborted' | 'resume_requested';
}

export interface RunStateSnapshot {
  sessionId: string;
  status: WorkflowRunStatus;
  startedAt?: number;
  updatedAt: number;
  error?: string;
  checkpoint?: RunCheckpoint;
}

interface ActiveRun {
  controller: AbortController;
  checkpoint?: RunCheckpoint;
}

export class SessionRunAlreadyActiveError extends Error {
  constructor(sessionId: string) {
    super(`run already active for session "${sessionId}"`);
  }
}

export class RunStateStore {
  private readonly snapshots = new Map<string, RunStateSnapshot>();
  private readonly activeRuns = new Map<string, ActiveRun>();

  beginRun(sessionId: string, externalAbort?: AbortSignal): AbortSignal {
    const current = this.snapshots.get(sessionId);
    if (current?.status === 'running' || this.activeRuns.has(sessionId)) {
      throw new SessionRunAlreadyActiveError(sessionId);
    }

    const controller = new AbortController();
    if (externalAbort) {
      if (externalAbort.aborted) {
        controller.abort(externalAbort.reason);
      } else {
        externalAbort.addEventListener('abort', () => controller.abort(externalAbort.reason), { once: true });
      }
    }

    this.activeRuns.set(sessionId, { controller });
    this.snapshots.set(sessionId, {
      sessionId,
      status: 'running',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return controller.signal;
  }

  completeRun(sessionId: string): void {
    this.activeRuns.delete(sessionId);
    this.snapshots.set(sessionId, {
      sessionId,
      status: 'completed',
      startedAt: this.snapshots.get(sessionId)?.startedAt,
      updatedAt: Date.now(),
      checkpoint: this.snapshots.get(sessionId)?.checkpoint,
    });
  }

  failRun(sessionId: string, error: string): void {
    this.activeRuns.delete(sessionId);
    this.snapshots.set(sessionId, {
      sessionId,
      status: 'error',
      startedAt: this.snapshots.get(sessionId)?.startedAt,
      updatedAt: Date.now(),
      error,
      checkpoint: this.snapshots.get(sessionId)?.checkpoint,
    });
  }

  abortRun(sessionId: string): boolean {
    const active = this.activeRuns.get(sessionId);
    if (!active) return false;

    const checkpoint: RunCheckpoint = {
      sessionId,
      stage: 'loop',
      createdAt: Date.now(),
      reason: 'aborted',
    };
    active.checkpoint = checkpoint;
    this.snapshots.set(sessionId, {
      sessionId,
      status: 'aborted',
      startedAt: this.snapshots.get(sessionId)?.startedAt,
      updatedAt: Date.now(),
      checkpoint,
    });
    active.controller.abort(new DOMException('Aborted', 'AbortError'));
    return true;
  }

  markAborted(sessionId: string, reason: RunCheckpoint['reason'] = 'aborted'): void {
    const checkpoint: RunCheckpoint = {
      sessionId,
      stage: 'loop',
      createdAt: Date.now(),
      reason,
    };
    this.activeRuns.delete(sessionId);
    this.snapshots.set(sessionId, {
      sessionId,
      status: 'aborted',
      startedAt: this.snapshots.get(sessionId)?.startedAt,
      updatedAt: Date.now(),
      checkpoint,
    });
  }

  resumeRun(sessionId: string): RunCheckpoint | undefined {
    const snapshot = this.snapshots.get(sessionId);
    const checkpoint = snapshot?.checkpoint;
    if (!checkpoint) return undefined;

    this.snapshots.set(sessionId, {
      sessionId,
      status: 'idle',
      startedAt: snapshot?.startedAt,
      updatedAt: Date.now(),
      checkpoint,
    });
    return checkpoint;
  }

  getSnapshot(sessionId: string): RunStateSnapshot | undefined {
    return this.snapshots.get(sessionId);
  }
}

const defaultRunStateStore = new RunStateStore();

export function getDefaultRunStateStore(): RunStateStore {
  return defaultRunStateStore;
}
