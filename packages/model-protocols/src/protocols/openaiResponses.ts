import type {
  GenerationMessage,
  ResolvedModelProfile,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';
import { postJson, trimTrailingSlash } from '../http';
import type { ProtocolAdapter, ProtocolCallContext } from '../types';

/**
 * `apiFormat: 'openai-responses'` — POST {baseUrl}/responses.
 *
 * The newer OpenAI Responses API. The wire shape differs from chat-completions:
 * input is a single `input` array (or string), `instructions` carries system
 * messages, and the response is an output array.
 */
type OpenAiResponsesResponse = {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  output_text?: string;
};

function joinSystemMessages(messages: GenerationMessage[]): string | undefined {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  return system || undefined;
}

function toResponsesInput(messages: GenerationMessage[]) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role,
      content: [{ type: 'input_text', text: m.content }],
    }));
}

function extractText(raw: OpenAiResponsesResponse): string {
  if (raw.output_text) return raw.output_text;
  return (
    raw.output
      ?.flatMap((entry) => entry.content ?? [])
      .map((part) => part.text ?? '')
      .join('') ?? ''
  );
}

async function generateText(
  profile: ResolvedModelProfile,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const raw = await postJson<OpenAiResponsesResponse>({
    url: `${baseUrl}/responses`,
    headers: { authorization: `Bearer ${profile.apiKey}` },
    body: {
      model: profile.modelId,
      input: toResponsesInput(request.messages),
      instructions: joinSystemMessages(request.messages),
      temperature: request.temperature,
      max_output_tokens: request.maxTokens,
      ...(request.providerOptions ?? {}),
    },
    signal: ctx?.signal,
  });

  return {
    provider: 'openai',
    model: profile.modelId,
    text: extractText(raw),
    raw,
  };
}

export const openaiResponsesProtocol: ProtocolAdapter = {
  apiFormat: 'openai-responses',
  generateText,
};
