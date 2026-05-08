import type { RemoteModel } from '@orison/shared-contracts';
import { resolveModelInfo } from '@orison/shared-contracts';
import { getJson } from './http';
import type { ListModelsRequest } from './types';

export async function listModels(request: ListModelsRequest): Promise<RemoteModel[]> {
  const url = `${request.baseUrl.replace(/\/+$/, '')}/v1/models`;
  const body = await getJson<{ data?: Array<{ id?: string }> }>({
    url,
    headers: { authorization: `Bearer ${request.apiKey}` },
    signal: request.signal,
  });
  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => {
      const info = resolveModelInfo(id);
      return { id, capability: info.capability, alias: info.alias };
    });
}
