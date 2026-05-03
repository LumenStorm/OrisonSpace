import type { TextGenerationRequest, TextGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type OpenAiTextResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function generateOpenAiText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://api.openai.com/v1');
  const raw = await postJson<OpenAiTextResponse>({
    url: `${baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${request.apiKey ?? ''}` },
    body: {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    },
  });

  return {
    provider: 'openai',
    model: request.model,
    text: raw.choices?.[0]?.message?.content ?? '',
    raw,
  };
}
