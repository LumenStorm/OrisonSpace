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
 * `apiFormat: 'claude-messages'` — POST {baseUrl}/v1/messages with
 * `x-api-key` + `anthropic-version`.
 */
type ClaudeMessagesResponse = {
  id?: string;
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

function splitSystem(messages: GenerationMessage[]): { system: string | undefined; conversation: { role: string; content: string }[] } {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const conversation = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  return { system: system || undefined, conversation };
}

function mapFinishReason(raw: string | undefined): GenerationFinishReason | undefined {
  switch (raw) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_use';
    case undefined:
      return undefined;
    default:
      return 'other';
  }
}

function mapUsage(raw: ClaudeMessagesResponse['usage']): GenerationUsage | undefined {
  if (!raw) return undefined;
  const prompt = raw.input_tokens;
  const completion = raw.output_tokens;
  const total =
    prompt !== undefined && completion !== undefined ? prompt + completion : undefined;
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
  };
}

async function generateText(
  profile: ResolvedModelProfile,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const { system, conversation } = splitSystem(request.messages);
  const opts = request.providerOptions?.['claude-messages'] ?? {};
  const raw = await postJson<ClaudeMessagesResponse>({
    url: `${baseUrl}/v1/messages`,
    headers: {
      'x-api-key': profile.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: profile.modelId,
      system,
      messages: conversation,
      temperature: request.temperature,
      max_tokens: request.maxTokens ?? 1024,
      ...opts,
    },
    signal: ctx?.signal,
  });

  return {
    provider: 'anthropic',
    model: profile.modelId,
    text: raw.content?.map((part) => part.text ?? '').join('') ?? '',
    id: raw.id,
    usage: mapUsage(raw.usage),
    finishReason: mapFinishReason(raw.stop_reason),
    raw,
  };
}

export const claudeMessagesProtocol: ProtocolAdapter = {
  apiFormat: 'claude-messages',
  generateText,
};
