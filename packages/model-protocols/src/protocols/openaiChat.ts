import type {
  ResolvedModelProfile,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';
import type { ProtocolAdapter, ProtocolCallContext } from '../types';

/**
 * `apiFormat: 'openai-chat-completions'` — POST {baseUrl}/chat/completions.
 *
 * Covers OpenAI direct, NewAPI relay, and any third-party endpoint that
 * advertises OpenAI-compatible chat completions.
 */
type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function generateText(
  profile: ResolvedModelProfile,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const raw = await postJson<OpenAiChatResponse>({
    url: `${baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${profile.apiKey}` },
    body: {
      model: profile.modelId,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      ...(request.providerOptions ?? {}),
    },
    signal: ctx?.signal,
  });

  return {
    provider: 'openai',
    model: profile.modelId,
    text: raw.choices?.[0]?.message?.content ?? '',
    raw,
  };
}

export const openaiChatProtocol: ProtocolAdapter = {
  apiFormat: 'openai-chat-completions',
  generateText,
};
