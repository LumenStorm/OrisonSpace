import type {
  GenerationMessage,
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
  }>;
};

function toGeminiContents(messages: GenerationMessage[]) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.role === 'system' ? `System: ${m.content}` : m.content }],
  }));
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
  const raw = await postJson<GeminiGenerateContentResponse>({
    url,
    body: {
      contents: toGeminiContents(request.messages),
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
      ...(request.providerOptions ?? {}),
    },
    signal: ctx?.signal,
  });

  return {
    provider: 'gcp',
    model: profile.modelId,
    text:
      raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '',
    raw,
  };
}

export const geminiGenerateContentProtocol: ProtocolAdapter = {
  apiFormat: 'gemini-generate-content',
  generateText,
};
