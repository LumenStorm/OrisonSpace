import type {
  GenerationFinishReason,
  GenerationUsage,
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
  id?: string;
  created?: number;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function mapFinishReason(raw: string | undefined): GenerationFinishReason | undefined {
  switch (raw) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'content_filter': return 'content_filter';
    case 'tool_calls': return 'tool_use';
    case undefined: return undefined;
    default: return 'other';
  }
}

function mapUsage(raw: OpenAiChatResponse['usage']): GenerationUsage | undefined {
  if (!raw) return undefined;
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    totalTokens: raw.total_tokens,
  };
}

async function generateText(
  profile: ResolvedModelProfile,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const opts = request.providerOptions?.['openai-chat-completions'] ?? {};
  const raw = await postJson<OpenAiChatResponse>({
    url: `${baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${profile.apiKey}` },
    body: {
      model: profile.modelId,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      ...opts,
    },
    signal: ctx?.signal,
  });

  return {
    provider: 'openai',
    model: profile.modelId,
    text: raw.choices?.[0]?.message?.content ?? '',
    id: raw.id,
    created: raw.created,
    usage: mapUsage(raw.usage),
    finishReason: mapFinishReason(raw.choices?.[0]?.finish_reason),
    raw,
  };
}

export const openaiChatProtocol: ProtocolAdapter = {
  apiFormat: 'openai-chat-completions',
  generateText,
};
