import type { RemoteModel } from '@orison/shared-contracts';
import { resolveModelInfo } from '@orison/shared-contracts';
import { getJson, normalizeBaseUrl } from './http';
import { ProtocolHttpError } from './errors';
import type { ListModelsRequest } from './types';

export async function listModels(request: ListModelsRequest): Promise<RemoteModel[]> {
  const url = `${normalizeBaseUrl(request.baseUrl)}/models`;
  const headers: Record<string, string> = request.protocol === 'anthropic-compatible'
    ? { 'x-api-key': request.apiKey, 'anthropic-version': '2023-06-01' }
    : { authorization: `Bearer ${request.apiKey}` };
  let body: { data?: Array<{ id?: string }> };
  try {
    body = await getJson<{ data?: Array<{ id?: string }> }>({
      url,
      headers,
      signal: request.signal,
    });
  } catch (error) {
    const fallbackUrl = deepSeekAnthropicModelsFallbackUrl(request);
    if (!(error instanceof ProtocolHttpError) || error.status !== 404 || !fallbackUrl) {
      throw error;
    }
    body = await getJson<{ data?: Array<{ id?: string }> }>({
      url: fallbackUrl,
      headers: { authorization: `Bearer ${request.apiKey}` },
      signal: request.signal,
    });
  }

  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => {
      const info = resolveModelInfo(id);
      return { id, capability: info.capability, alias: info.alias };
    });
}

function deepSeekAnthropicModelsFallbackUrl(request: ListModelsRequest): string | null {
  if (request.protocol !== 'anthropic-compatible') return null;

  const base = request.baseUrl.replace(/\/+$/, '');
  if (!/\/anthropic$/i.test(base)) return null;

  return `${base.replace(/\/anthropic$/i, '')}/models`;
}
