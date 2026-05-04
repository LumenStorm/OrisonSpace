import { ipcMain } from 'electron';
import type {
  ModelCapability,
  ProviderModel,
  ProviderModelListRequest,
} from '@orison/shared-contracts';

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

export function registerModelProviderIpc() {
  ipcMain.handle('model:list-provider-models', async (_event, request: ProviderModelListRequest) => {
    return listProviderModels(request);
  });
}

async function listProviderModels(request: ProviderModelListRequest): Promise<ProviderModel[]> {
  const url = buildModelsUrl(request);
  const response = await fetch(url, {
    headers: buildModelListHeaders(request),
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    throw new Error(message || `Model list request failed: ${response.status}`);
  }

  const body = await response.json();
  return request.provider === 'gcp'
    ? parseGeminiModels(body as GeminiModelListResponse)
    : parseOpenAiModels(body as OpenAiModelListResponse);
}

function buildModelsUrl({ provider, baseUrl, apiKey }: ProviderModelListRequest): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const url = new URL(`${trimmed}/models`);
  if (provider === 'gcp' && apiKey) {
    url.searchParams.set('key', apiKey);
  }
  return url.toString();
}

function buildModelListHeaders({ provider, apiKey }: ProviderModelListRequest): Record<string, string> {
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

function parseOpenAiModels(body: OpenAiModelListResponse): ProviderModel[] {
  return (body.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, capabilities: inferCapabilities(id) }));
}

function parseGeminiModels(body: GeminiModelListResponse): ProviderModel[] {
  return (body.models ?? [])
    .map((item) => item.name?.replace(/^models\//, '') ?? item.displayName)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, capabilities: inferCapabilities(id) }));
}

function inferCapabilities(model: string): ModelCapability[] {
  const lower = model.toLowerCase();
  if (lower.includes('image') || lower.includes('imagen') || lower.includes('dall-e')) return ['image'];
  if (lower.includes('video') || lower.includes('veo') || lower.includes('sora')) return ['video'];
  return ['text'];
}

async function readProviderError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.error?.message === 'string') return parsed.error.message;
    if (typeof parsed?.message === 'string') return parsed.message;
  } catch {
    // Plain text provider errors are useful as-is.
  }
  return text.slice(0, 200);
}
