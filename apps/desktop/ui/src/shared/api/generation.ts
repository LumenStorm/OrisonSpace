import {
  imageGenerationResponseSchema,
  type GenerationProvider,
  type ImageGenerationResponse,
  type ModelSlotConfig,
  type ProviderModel,
} from '@orison/shared-contracts';
import { API_BASE } from '../constants';
import { throwIfSessionExpired } from './session';

export type RemoteModel = ProviderModel;

type LoadProviderModelsInput = {
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
};

/**
 * Optional advanced parameters forwarded to the server. Mirrors a subset of
 * `imageGenerationRequestSchema` so callers can pass whichever fields the
 * Inspector has surfaced.
 */
export type ImageGenerationParams = {
  size?: string;
  n?: number;
  quality?: 'auto' | 'low' | 'medium' | 'high';
  background?: 'transparent' | 'opaque' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
  outputCompression?: number;
  moderation?: 'low' | 'auto';
  user?: string;
};

type GenerateImageInput = {
  slot: ModelSlotConfig;
  prompt: string;
  token: string | null;
  params: ImageGenerationParams;
};

export async function loadProviderModels({
  provider,
  apiKey,
  baseUrl,
}: LoadProviderModelsInput): Promise<RemoteModel[]> {
  if (window.orisonDesktop?.listProviderModels) {
    return window.orisonDesktop.listProviderModels({ provider, apiKey, baseUrl });
  }
  throw new Error('Desktop model provider bridge is unavailable');
}

export async function generateImage({
  slot,
  prompt,
  token,
  params,
}: GenerateImageInput): Promise<ImageGenerationResponse> {
  const body: Record<string, unknown> = {
    model: slot.model,
    apiKey: slot.apiKey,
    baseUrl: slot.baseUrl,
    prompt,
  };
  if (params.size !== undefined) body.size = params.size;
  if (params.n !== undefined) body.n = params.n;
  if (params.quality !== undefined) body.quality = params.quality;
  if (params.background !== undefined) body.background = params.background;
  if (params.outputFormat !== undefined) body.outputFormat = params.outputFormat;
  if (params.outputCompression !== undefined) body.outputCompression = params.outputCompression;
  if (params.moderation !== undefined) body.moderation = params.moderation;
  if (params.user !== undefined && params.user !== '') body.user = params.user;

  const response = await fetch(`${API_BASE}/v1/generation/${slot.provider}/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  throwIfSessionExpired(response);

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.status}`);
  }

  return imageGenerationResponseSchema.parse(await response.json());
}
