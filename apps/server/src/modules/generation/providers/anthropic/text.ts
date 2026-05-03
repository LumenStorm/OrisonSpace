import type { GenerationMessage, TextGenerationRequest, TextGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type AnthropicTextResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

function splitSystem(messages: GenerationMessage[]) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content }));

  return { system, conversation };
}

export async function generateAnthropicText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://api.anthropic.com');
  const { system, conversation } = splitSystem(request.messages);
  const raw = await postJson<AnthropicTextResponse>({
    url: `${baseUrl}/v1/messages`,
    headers: {
      'x-api-key': request.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: request.model,
      system: system || undefined,
      messages: conversation,
      temperature: request.temperature,
      max_tokens: request.maxTokens ?? 1024,
    },
  });

  return {
    provider: 'anthropic',
    model: request.model,
    text: raw.content?.map((part) => part.text ?? '').join('') ?? '',
    raw,
  };
}
