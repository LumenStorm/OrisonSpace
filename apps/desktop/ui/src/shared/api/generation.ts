import type { GenerationProvider } from '@orison/shared-contracts';

export type RemoteModel = {
  id: string;
  capabilities: Array<'text' | 'image' | 'video'>;
};

type LoadProviderModelsInput = {
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
};

type OpenAiModelListResponse = {
  data?: Array<{ id?: string }>;
};

type GeminiModelListResponse = {
  models?: Array<{
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
};

export async function loadProviderModels({
  provider,
  apiKey,
  baseUrl,
}: LoadProviderModelsInput): Promise<RemoteModel[]> {
  const url = buildModelsUrl(provider, baseUrl, apiKey);
  const response = await fetch(url, {
    headers: buildModelListHeaders(provider, apiKey),
  });

  if (!response.ok) {
    throw new Error(`Model list request failed: ${response.status}`);
  }

  const body = await response.json();
  return provider === 'gcp'
    ? parseGeminiModels(body as GeminiModelListResponse)
    : parseOpenAiModels(body as OpenAiModelListResponse);
}

function buildModelsUrl(provider: GenerationProvider, baseUrl: string, apiKey: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const url = new URL(`${trimmed}/models`);
  if (provider === 'gcp' && apiKey) {
    url.searchParams.set('key', apiKey);
  }
  return url.toString();
}

function buildModelListHeaders(provider: GenerationProvider, apiKey: string): Record<string, string> {
  if (!apiKey) return {};
  if (provider === 'anthropic') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
  if (provider === 'gcp') {
    return { 'x-goog-api-key': apiKey };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

function parseOpenAiModels(body: OpenAiModelListResponse): RemoteModel[] {
  return (body.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, capabilities: inferCapabilities(id) }));
}

function parseGeminiModels(body: GeminiModelListResponse): RemoteModel[] {
  return (body.models ?? [])
    .map((item) => item.name?.replace(/^models\//, '') ?? item.displayName)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, capabilities: inferCapabilities(id) }));
}

function inferCapabilities(model: string): Array<'text' | 'image' | 'video'> {
  const lower = model.toLowerCase();
  if (lower.includes('image') || lower.includes('imagen') || lower.includes('dall-e')) return ['image'];
  if (lower.includes('video') || lower.includes('veo') || lower.includes('sora')) return ['video'];
  return ['text'];
}
