import {
  textGenerationRequestSchema,
  textGenerationResponseSchema,
  type GenerationMessage,
  type GenerationProvider,
  type TextGenerationResponse,
} from '@orison/shared-contracts';

/**
 * 轻量 LLM 客户端：通过 server `POST /v1/generation/:provider/text` 走 provider。
 *
 * 设计要点：
 *  - 不引入额外依赖，直接走 fetch；失败信息保持原始报文以便上层决定 fallback。
 *  - request/response 走 shared-contracts schema 校验，避免 server 偷换形状被忽略。
 *  - 调用方负责设置超时（AbortSignal），本模块不做隐式超时。
 */
export type LlmTextOptions = {
  serverUrl: string;
  provider: GenerationProvider;
  model: string;
  messages: GenerationMessage[];
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export class LlmClientError extends Error {
  constructor(message: string, readonly status?: number, readonly cause?: unknown) {
    super(message);
    this.name = 'LlmClientError';
  }
}

export async function generateText(options: LlmTextOptions): Promise<TextGenerationResponse> {
  const url = `${options.serverUrl.replace(/\/$/, '')}/v1/generation/${options.provider}/text`;
  const body = textGenerationRequestSchema.parse({
    model: options.model,
    messages: options.messages,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    throw new LlmClientError(
      `LLM request failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new LlmClientError(
      `LLM HTTP ${response.status}: ${text.slice(0, 500)}`,
      response.status,
    );
  }

  const json = await response.json().catch((err) => {
    throw new LlmClientError('LLM response is not valid JSON', response.status, err);
  });

  const parsed = textGenerationResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new LlmClientError(
      `LLM response failed schema validation: ${parsed.error.message}`,
      response.status,
      parsed.error,
    );
  }
  return parsed.data;
}
