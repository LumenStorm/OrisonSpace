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
 * Routing is by `provider`, not `apiFormat` — at list time no per-model
 * `apiFormat` exists yet. NewAPI relays piggyback on `provider='openai'`
 * because they expose the OpenAI-compatible /v1/models endpoint.
 */
export async function listModels(
  provider: GenerationProvider,
  request: ListModelsRequest,
): Promise<ProviderModel[]> {
  switch (provider) {
    case 'openai':
      return listOpenAi(request);
    case 'anthropic':
      return listAnthropic(request);
    case 'gcp':
      return listGcp(request);
    default: {
      // Exhaustiveness check.
      const exhaustive: never = provider;
      throw new Error(`Unknown provider: ${exhaustive as string}`);
    }
  }
}

function trim(value: string): string {
  return value.replace(/\/+$/, '');
}

type OpenAiModelsResponse = {
  data?: Array<{ id?: string }>;
};

async function listOpenAi(request: ListModelsRequest): Promise<ProviderModel[]> {
  const url = `${trim(request.baseUrl)}/v1/models`;
  const body = await getJson<OpenAiModelsResponse>({
    url,
    headers: { authorization: `Bearer ${request.apiKey}` },
    signal: request.signal,
  });
  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, capabilities: inferCapabilities(id) }));
}

type AnthropicModelsResponse = {
  data?: Array<{ id?: string; display_name?: string }>;
};

async function listAnthropic(request: ListModelsRequest): Promise<ProviderModel[]> {
  const url = `${trim(request.baseUrl)}/v1/models`;
  const body = await getJson<AnthropicModelsResponse>({
    url,
    headers: {
      'x-api-key': request.apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: request.signal,
  });
  return (body.data ?? [])
    .map((entry) => entry.id ?? entry.display_name)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, capabilities: inferCapabilities(id) }));
}

type GcpModelsResponse = {
  models?: Array<{
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
};

async function listGcp(request: ListModelsRequest): Promise<ProviderModel[]> {
  const url = new URL(`${trim(request.baseUrl)}/v1beta/models`);
  url.searchParams.set('key', request.apiKey);
  const body = await getJson<GcpModelsResponse>({
    url: url.toString(),
    headers: { 'x-goog-api-key': request.apiKey },
    signal: request.signal,
  });
  return (body.models ?? [])
    .map((entry) => entry.name?.replace(/^models\//, '') ?? entry.displayName)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, capabilities: inferCapabilities(id) }));
}

function inferCapabilities(modelId: string): ModelCapability[] {
  const id = modelId.toLowerCase();
  if (id.includes('image') || id.includes('imagen') || id.includes('dall-e')) return ['image'];
  if (id.includes('video') || id.includes('veo') || id.includes('sora')) return ['video'];
  return ['text'];
}
