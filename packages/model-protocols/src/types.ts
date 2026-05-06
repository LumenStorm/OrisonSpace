import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ModelApiFormat,
  ProviderModel,
  ResolvedModelProfile,
  TextGenerationRequest,
  TextGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  GenerationProvider,
} from '@orison/shared-contracts';

/**
 * Verbs of the protocol layer.
 *
 * `listModels` is intentionally **not** a verb — model listing is
 * provider-level (one implementation per `provider`) and lives in
 * `listModels.ts`, not in protocol adapters.
 */
export type ProtocolVerb = 'generateText' | 'generateImage' | 'generateVideo';

export type ProtocolCallContext = {
  /** Caller-provided abort signal forwarded to the underlying fetch. */
  signal?: AbortSignal;
};

export type ProtocolAdapter = {
  apiFormat: ModelApiFormat;
  generateText?(
    profile: ResolvedModelProfile,
    request: TextGenerationRequest,
    ctx?: ProtocolCallContext,
  ): Promise<TextGenerationResponse>;
  generateImage?(
    profile: ResolvedModelProfile,
    request: ImageGenerationRequest,
    ctx?: ProtocolCallContext,
  ): Promise<ImageGenerationResponse>;
  generateVideo?(
    profile: ResolvedModelProfile,
    request: VideoGenerationRequest,
    ctx?: ProtocolCallContext,
  ): Promise<VideoGenerationResponse>;
};

export type ListModelsRequest = {
  baseUrl: string;
  apiKey: string;
  signal?: AbortSignal;
};

export type ListModelsAdapter = {
  provider: GenerationProvider;
  listModels(request: ListModelsRequest): Promise<ProviderModel[]>;
};
