import type {
  GenerationMessage,
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
  content?: Array<{ type?: string; text?: string }>;
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

async function generateText(
  profile: ResolvedModelProfile,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const { system, conversation } = splitSystem(request.messages);
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
      ...(request.providerOptions ?? {}),
    },
    signal: ctx?.signal,
  });

  return {
    provider: 'anthropic',
    model: profile.modelId,
    text: raw.content?.map((part) => part.text ?? '').join('') ?? '',
    raw,
  };
}

export const claudeMessagesProtocol: ProtocolAdapter = {
  apiFormat: 'claude-messages',
  generateText,
};
