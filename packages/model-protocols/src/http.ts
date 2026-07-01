import { ProtocolHttpError } from './errors';

export type JsonRequestOptions = {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Normalize baseUrl: ensure it ends with /v1 (user may or may not include it). */
export function normalizeBaseUrl(value: string): string {
  const base = trimTrailingSlash(value);
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

/**
 * Internal helper for protocol adapters: POSTs JSON, parses JSON, and maps
 * non-2xx responses to `ProtocolHttpError` with a body excerpt for triage.
 */
export async function postJson<T>({
  url,
  method = 'POST',
  headers = {},
  body,
  signal,
}: JsonRequestOptions): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed && 'error' in parsed && parsed.error && typeof (parsed as any).error === 'object'
        ? typeof (parsed as any).error.message === 'string'
          ? (parsed as any).error.message
          : `Provider request failed with ${response.status}`
        : `Provider request failed with ${response.status}`;
    throw new ProtocolHttpError(message, response.status, text.slice(0, 500));
  }

  return parsed as T;
}

export async function getJson<T>({
  url,
  headers = {},
  signal,
}: { url: string; headers?: Record<string, string>; signal?: AbortSignal }): Promise<T> {
  const response = await fetch(url, { method: 'GET', headers, signal });
  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    throw new ProtocolHttpError(
      `Provider request failed with ${response.status}`,
      response.status,
      text.slice(0, 500),
    );
  }

  return parsed as T;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Internal helper for protocol adapters that need multipart/form-data (e.g.
 * OpenAI `/images/edits`). Callers pass a fully-built FormData; we do NOT
 * set `content-type` manually — `fetch` will attach the correct boundary.
 */
export async function postMultipart<T>({
  url,
  headers = {},
  formData,
  signal,
}: {
  url: string;
  headers?: Record<string, string>;
  formData: FormData;
  signal?: AbortSignal;
}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    signal,
  });

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed && 'error' in parsed && parsed.error && typeof (parsed as any).error === 'object'
        ? typeof (parsed as any).error.message === 'string'
          ? (parsed as any).error.message
          : `Provider request failed with ${response.status}`
        : `Provider request failed with ${response.status}`;
    throw new ProtocolHttpError(message, response.status, text.slice(0, 500));
  }

  return parsed as T;
}

/**
 * Convert a base64 payload to a Blob suitable for FormData uploads.
 * The input must be raw base64 (no `data:...;base64,` prefix) — the UI
 * strips that in `dataUrlToBase64` before reaching the gateway.
 */
export function base64ToBlob(b64Json: string, mimeType: string): Blob {
  const binary = globalThis.atob(b64Json);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
