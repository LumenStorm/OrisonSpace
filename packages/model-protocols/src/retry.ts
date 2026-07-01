import { ProtocolHttpError } from './errors';

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
};

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isRetryable(err: unknown): boolean {
  if (err instanceof ProtocolHttpError) {
    return RETRYABLE_STATUS_CODES.has(err.status);
  }
  if (err instanceof TypeError && err.message.includes('fetch')) return true;
  if (err instanceof Error && err.name === 'ConnectTimeoutError') return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 500;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      if (opts.signal?.aborted) break;
      if (!isRetryable(err)) break;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay, opts.signal);
    }
  }
  throw lastError;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
