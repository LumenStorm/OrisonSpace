import type {
  GenerationFinishReason,
  GenerationMessage,
  GenerationUsage,
  ResolvedModelProfile,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';
import type { ProtocolAdapter, ProtocolCallContext } from '../types';

/**
 * `apiFormat: 'gemini-generate-content'` — POST
 * {baseUrl}/v1beta/models/{model}:generateContent?key=...
 */
type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

function toGeminiContents(messages: GenerationMessage[]) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.role === 'system' ? `System: ${m.content}` : m.content }],
  }));
}

function mapFinishReason(raw: string | undefined): GenerationFinishReason | undefined {
  switch (raw) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
      return 'content_filter';
    case undefined:
      return undefined;
    default:
      return 'other';
  }
}

function mapUsage(raw: GeminiGenerateContentResponse['usageMetadata']): GenerationUsage | undefined {
  if (!raw) return undefined;
  return {
    promptTokens: raw.promptTokenCount,
    completionTokens: raw.candidatesTokenCount,
    totalTokens: raw.totalTokenCount,
  };
}

async function generateText(
  profile: ResolvedModelProfile,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const url =
    `${baseUrl}/v1beta/models/${encodeURIComponent(profile.modelId)}:generateContent` +
    `?key=${encodeURIComponent(profile.apiKey)}`;
  const opts = request.providerOptions?.['gemini-generate-content'] ?? {};
  const raw = await postJson<GeminiGenerateContentResponse>({
    url,
    body: {
      contents: toGeminiContents(request.messages),
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
      ...opts,
    },
    signal: ctx?.signal,
  });

  return {
    provider: 'gcp',
    model: profile.modelId,
    text:
      raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '',
    usage: mapUsage(raw.usageMetadata),
    finishReason: mapFinishReason(raw.candidates?.[0]?.finishReason),
    raw,
  };
}

export const geminiGenerateContentProtocol: ProtocolAdapter = {
  apiFormat: 'gemini-generate-content',
  generateText,
};
