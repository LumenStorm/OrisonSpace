import type { z } from 'zod';
import { taskRequestSchema, taskResultSchema } from '@orison/shared-contracts';
import { TASK_CACHE_TTL_MS } from './cachePolicy';

type TaskRequest = z.infer<typeof taskRequestSchema>;
type TaskResult = z.infer<typeof taskResultSchema>;

const store = new Map<string, { request: TaskRequest; result: TaskResult; createdAt: number }>();

/** Remove entries older than TASK_CACHE_TTL_MS */
function evictStale() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TASK_CACHE_TTL_MS) {
      store.delete(key);
    }
  }
}

// Run eviction every 60 seconds
const EVICTION_INTERVAL_MS = 60_000;
let evictionTimer: ReturnType<typeof setInterval> | null = null;

function ensureEvictionTimer() {
  if (evictionTimer) return;
  evictionTimer = setInterval(evictStale, EVICTION_INTERVAL_MS);
  // Allow the process to exit even if the timer is still running
  if (typeof evictionTimer === 'object' && 'unref' in evictionTimer) {
    evictionTimer.unref();
  }
}

export const taskStore = {
  save(request: TaskRequest, result: TaskResult) {
    ensureEvictionTimer();
    store.set(request.taskId, {
      request,
      result,
      createdAt: Date.now()
    });
  },
  get(taskId: string) {
    const entry = store.get(taskId);
    if (!entry) return undefined;
    // Lazy eviction on read
    if (Date.now() - entry.createdAt > TASK_CACHE_TTL_MS) {
      store.delete(taskId);
      return undefined;
    }
    return entry;
  },
  update(taskId: string, result: TaskResult) {
    const current = store.get(taskId);
    if (!current) return;
    store.set(taskId, { ...current, result });
  }
};
