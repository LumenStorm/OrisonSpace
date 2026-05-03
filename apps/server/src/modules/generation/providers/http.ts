import { GenerationProviderError } from './types';

export type JsonRequestOptions = {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
};

export async function postJson<T>({ url, method = 'POST', headers = {}, body }: JsonRequestOptions): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof parsed?.error?.message === 'string'
      ? parsed.error.message
      : `Generation provider request failed with ${response.status}`;
    throw new GenerationProviderError(message, response.status);
  }

  return parsed as T;
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
