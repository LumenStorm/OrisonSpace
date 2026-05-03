import type { GenerationMessage, TextGenerationRequest, TextGenerationResponse } from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';

type GcpTextResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function toGcpContents(messages: GenerationMessage[]) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.role === 'system' ? `System: ${message.content}` : message.content }],
  }));
}

export async function generateGcpText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(request.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta');
  const raw = await postJson<GcpTextResponse>({
    url: `${baseUrl}/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey ?? '')}`,
    body: {
      contents: toGcpContents(request.messages),
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
    },
  });

  return {
    provider: 'gcp',
    model: request.model,
    text: raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
    raw,
  };
}
