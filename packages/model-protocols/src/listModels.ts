import type {
  GenerationProvider,
  ModelCapability,
  ProviderModel,
} from '@orison/shared-contracts';
import { getJson } from './http';
import type { ListModelsRequest } from './types';

/**
 * Provider-level model listing.
 *
 * Always uses the OpenAI-compatible `/v1/models` endpoint with Bearer auth.
 * This covers direct OpenAI, NewAPI / OneAPI relays, and any service that
 * exposes the standard `/v1/models` shape. The `provider` parameter is
 * retained for type compatibility but ignored at runtime.
 */
export async function listModels(
  _provider: GenerationProvider,
  request: ListModelsRequest,
): Promise<ProviderModel[]> {
  const url = `${request.baseUrl.replace(/\/+$/, '')}/v1/models`;
  const body = await getJson<{ data?: Array<{ id?: string }> }>({
    url,
    headers: { authorization: `Bearer ${request.apiKey}` },
    signal: request.signal,
  });
  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, capabilities: inferCapabilities(id) }));
}

function inferCapabilities(modelId: string): ModelCapability[] {
  const id = modelId.toLowerCase();
  if (id.includes('image') || id.includes('imagen') || id.includes('dall-e')) return ['image'];
  if (id.includes('video') || id.includes('veo') || id.includes('sora')) return ['video'];
  return ['text'];
}
