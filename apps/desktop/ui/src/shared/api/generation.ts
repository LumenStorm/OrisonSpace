import type {
  GenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageInput,
  ProviderModel,
  SlotAssignment,
  TextGenerationRequest,
  TextGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from '@orison/shared-contracts';

export type RemoteModel = ProviderModel;

type LoadProviderModelsInput = {
  provider: GenerationProvider;
  apiKey: string;
  baseUrl: string;
};

/**
 * Optional advanced parameters forwarded to the desktop main process. Mirrors
 * a subset of `imageGenerationRequestSchema` so callers can pass whichever
 * fields the Inspector has surfaced.
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
  slot: SlotAssignment;
  prompt: string;
  params: ImageGenerationParams;
  /**
   * When set, triggers the image-edit path. OpenAI → `/v1/images/edits` with
   * `mask` applied when present. Gemini image-edit adapters silently drop
   * `mask` and use `image` as a reference alongside the prompt.
   */
  image?: ImageInput;
  mask?: ImageInput;
  referenceImages?: ImageInput[];
};

type GenerateTextInput = {
  slot: SlotAssignment;
  request: TextGenerationRequest;
};

type GenerateVideoInput = {
  slot: SlotAssignment;
  request: VideoGenerationRequest;
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

/**
 * Image generation through the desktop model gateway. Renderer never sees
 * `apiKey` or `baseUrl`; main resolves the slot, decrypts the key, and
 * dispatches via the right `apiFormat` adapter.
 */
export async function generateImage({
  slot,
  prompt,
  params,
  image,
  mask,
  referenceImages,
}: GenerateImageInput): Promise<ImageGenerationResponse> {
  if (!window.orisonDesktop?.generateImage) {
    throw new Error('Desktop model gateway is unavailable');
  }
  const request: ImageGenerationRequest = {
    model: slot.modelId,
    prompt,
  };
  if (params.size !== undefined) request.size = params.size;
  if (params.n !== undefined) request.n = params.n;
  if (params.quality !== undefined) request.quality = params.quality;
  if (params.background !== undefined) request.background = params.background;
  if (params.outputFormat !== undefined) request.outputFormat = params.outputFormat;
  if (params.outputCompression !== undefined) request.outputCompression = params.outputCompression;
  if (params.moderation !== undefined) request.moderation = params.moderation;
  if (params.user !== undefined && params.user !== '') request.user = params.user;
  if (image) request.image = image;
  if (mask) request.mask = mask;
  if (referenceImages && referenceImages.length > 0) request.referenceImages = referenceImages;
  return window.orisonDesktop.generateImage({ slot, request });
}

export async function generateText({ slot, request }: GenerateTextInput): Promise<TextGenerationResponse> {
  if (!window.orisonDesktop?.generateText) {
    throw new Error('Desktop model gateway is unavailable');
  }
  return window.orisonDesktop.generateText({ slot, request });
}

export async function generateVideo({ slot, request }: GenerateVideoInput): Promise<VideoGenerationResponse> {
  if (!window.orisonDesktop?.generateVideo) {
    throw new Error('Desktop model gateway is unavailable');
  }
  return window.orisonDesktop.generateVideo({ slot, request });
}
