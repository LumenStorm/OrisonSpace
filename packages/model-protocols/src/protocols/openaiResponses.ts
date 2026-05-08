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
 * `apiFormat: 'openai-responses'` — POST {baseUrl}/responses.
 *
 * The newer OpenAI Responses API. The wire shape differs from chat-completions:
 * input is a single `input` array (or string), `instructions` carries system
 * messages, and the response is an output array.
 */
type OpenAiResponsesResponse = {
  id?: string;
  created_at?: number;
  status?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
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

function mapFinishReason(raw: OpenAiResponsesResponse): GenerationFinishReason | undefined {
  if (!raw.status) return undefined;
  if (raw.status === 'completed') return 'stop';
  if (raw.status === 'incomplete') {
    return raw.incomplete_details?.reason === 'max_output_tokens' ? 'length' : 'other';
  }
  return 'other';
}

function mapUsage(raw: OpenAiResponsesResponse['usage']): GenerationUsage | undefined {
  if (!raw) return undefined;
  return {
    promptTokens: raw.input_tokens,
    completionTokens: raw.output_tokens,
    totalTokens: raw.total_tokens,
  };
}

async function generateText(
  profile: ResolvedModelProfile,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const baseUrl = trimTrailingSlash(profile.baseUrl);
  const opts = request.providerOptions?.['openai-responses'] ?? {};
  const raw = await postJson<OpenAiResponsesResponse>({
    url: `${baseUrl}/responses`,
    headers: { authorization: `Bearer ${profile.apiKey}` },
    body: {
      model: profile.modelId,
      input: toResponsesInput(request.messages),
      instructions: joinSystemMessages(request.messages),
      temperature: request.temperature,
      max_output_tokens: request.maxTokens,
      ...opts,
    },
    signal: ctx?.signal,
  });

  return {
    provider: 'openai',
    model: profile.modelId,
    text: extractText(raw),
    id: raw.id,
    created: raw.created_at,
    usage: mapUsage(raw.usage),
    finishReason: mapFinishReason(raw),
    raw,
  };
}

export const openaiResponsesProtocol: ProtocolAdapter = {
  apiFormat: 'openai-responses',
  generateText,
};
