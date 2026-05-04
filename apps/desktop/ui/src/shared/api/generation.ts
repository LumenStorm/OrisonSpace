import {
  imageGenerationResponseSchema,
  type GenerationProvider,
  type ImageGenerationResponse,
  type ModelSlotConfig,
  type ProviderModel,
} from '@orison/shared-contracts';
import { API_BASE } from '../constants';

export type RemoteModel = ProviderModel;

type LoadProviderModelsInput = {
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
};

type GenerateImageInput = {
  slot: ModelSlotConfig;
  prompt: string;
  size: string;
  n: number;
  token: string | null;
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
  size,
  n,
  token,
}: GenerateImageInput): Promise<ImageGenerationResponse> {
  const response = await fetch(`${API_BASE}/v1/generation/${slot.provider}/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      model: slot.model,
      apiKey: slot.apiKey,
      baseUrl: slot.baseUrl,
      prompt,
      size,
      n,
    }),
  });

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.status}`);
  }

  return imageGenerationResponseSchema.parse(await response.json());
}
