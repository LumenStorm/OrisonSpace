import { ProtocolHttpError } from './errors';

export type JsonRequestOptions = {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
};

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
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
