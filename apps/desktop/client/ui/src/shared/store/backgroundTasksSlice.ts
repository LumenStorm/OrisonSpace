import type { StateCreator } from 'zustand';
import { registerProjectReset } from './resetRegistry';

// ── Types ──

export type BgTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type BgTaskType = 'image_gen' | 'video_gen' | 'text_gen' | 'rewrite';

export type BgTask = {
  id: string;
  type: BgTaskType;
  status: BgTaskStatus;
  label: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: unknown;
};

export type SubmitBgTaskOpts = {
  type: BgTaskType;
  label: string;
  execute: (signal: AbortSignal) => Promise<unknown>;
};

export type BackgroundTasksSlice = {
  bgTasks: BgTask[];
  loadBgTasks: () => Promise<void>;
  submitBgTask: (opts: SubmitBgTaskOpts) => string;
  cancelBgTask: (taskId: string) => void;
  dismissBgTask: (taskId: string) => void;
  clearFinishedBgTasks: () => void;
};

type Deps = BackgroundTasksSlice & {
  currentProject: { projectId?: string } | null;
};

// ── Implementation ──

const MAX_HISTORY = 50;
const controllers = new Map<string, AbortController>();
let idCounter = 0;

function nextId(): string {
  return `bgt_${Date.now()}_${++idCounter}`;
}

/** Fire-and-forget persist to SQLite via preload. */
function persistTask(task: BgTask, projectId: string) {
  const statusMap: Record<BgTaskStatus, 'running' | 'completed' | 'failed'> = {
    running: 'running',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'failed',
  };
  window.orisonDesktop?.upsertTask({
    taskId: task.id,
    projectId,
    taskType: task.type,
    name: task.label,
    status: statusMap[task.status],
    errorMessage: task.error,
    outputPayload: task.result != null ? JSON.stringify(task.result) : undefined,
  });
}

export const createBackgroundTasksSlice: StateCreator<
  Deps,
  [],
  [],
  BackgroundTasksSlice
> = (set, get) => {
  let loadToken = 0;

  registerProjectReset(() => {
    loadToken += 1;
    set({ bgTasks: [] });
  });

  return {
  bgTasks: [],

  async loadBgTasks() {
    const token = ++loadToken;
    const projectId = get().currentProject?.projectId;
    if (!projectId || !window.orisonDesktop?.listTasks) {
      if (token === loadToken) set({ bgTasks: [] });
      return;
    }
    try {
      const records = await window.orisonDesktop.listTasks(projectId, MAX_HISTORY);
      if (token !== loadToken || get().currentProject?.projectId !== projectId) return;
      const tasks: BgTask[] = records.map((r) => ({
        id: r.taskId,
        type: r.taskType as BgTaskType,
        status: r.status === 'queued' ? 'running' : r.status,
        label: r.name,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        error: r.errorMessage,
        result: r.outputPayload ? tryParse(r.outputPayload) : undefined,
      }));
      set({ bgTasks: tasks });
    } catch {
      if (token === loadToken && get().currentProject?.projectId === projectId) {
        set({ bgTasks: [] });
      }
    }
  },

  submitBgTask(opts) {
    const id = nextId();
    const now = new Date().toISOString();
    const projectId = get().currentProject?.projectId;
    const task: BgTask = {
      id,
      type: opts.type,
      status: 'running',
      label: opts.label,
      createdAt: now,
      updatedAt: now,
    };

    set((s) => ({ bgTasks: [task, ...s.bgTasks].slice(0, MAX_HISTORY) }));
    if (projectId) persistTask(task, projectId);

    const ac = new AbortController();
    controllers.set(id, ac);

    opts.execute(ac.signal).then(
      (result) => {
        controllers.delete(id);
        if (ac.signal.aborted) return;
        const updated: BgTask = { ...task, status: 'completed', result, updatedAt: new Date().toISOString() };
        if (get().currentProject?.projectId === projectId) {
          set((s) => ({
            bgTasks: s.bgTasks.map((t) => (t.id === id ? updated : t)),
          }));
        }
        if (projectId) persistTask(updated, projectId);
      },
      (err) => {
        controllers.delete(id);
        if (ac.signal.aborted) return;
        const errMsg = err instanceof Error ? err.message : String(err);
        const updated: BgTask = { ...task, status: 'failed', error: errMsg, updatedAt: new Date().toISOString() };
        if (get().currentProject?.projectId === projectId) {
          set((s) => ({
            bgTasks: s.bgTasks.map((t) => (t.id === id ? updated : t)),
          }));
        }
        if (projectId) persistTask(updated, projectId);
      },
    );

    return id;
  },

  cancelBgTask(taskId) {
    const ac = controllers.get(taskId);
    if (ac) {
      ac.abort();
      controllers.delete(taskId);
    }
    const projectId = get().currentProject?.projectId;
    set((s) => ({
      bgTasks: s.bgTasks.map((t) => {
        if (t.id === taskId && t.status === 'running') {
          const updated: BgTask = { ...t, status: 'cancelled', updatedAt: new Date().toISOString() };
          if (projectId) persistTask(updated, projectId);
          return updated;
        }
        return t;
      }),
    }));
  },

  dismissBgTask(taskId) {
    set((s) => ({ bgTasks: s.bgTasks.filter((t) => t.id !== taskId) }));
    window.orisonDesktop?.deleteTask(taskId);
  },

  clearFinishedBgTasks() {
    const finished = get().bgTasks.filter((t) => t.status !== 'running');
    set((s) => ({ bgTasks: s.bgTasks.filter((t) => t.status === 'running') }));
    for (const t of finished) {
      window.orisonDesktop?.deleteTask(t.id);
    }
  },
  };
};

function tryParse(json: string): unknown {
  try { return JSON.parse(json); } catch { return undefined; }
}
