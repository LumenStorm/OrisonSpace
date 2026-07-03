import type {
  GenerationFinishReason,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ResolvedModel,
  TextGenerationRequest,
  TextGenerationResponse,
} from '@orison/shared-contracts';
import { generateText as aiGenerateText, jsonSchema, tool, APICallError } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { base64ToBlob, normalizeBaseUrl, postJson, postMultipart } from './http';
import { normalizeImageResponse } from './imageNormalize';
import { ProtocolHttpError } from './errors';
import { withRetry } from './retry';
import type { ProtocolCallContext } from './types';

// ── Provider factory ──

export function createProvider(model: ResolvedModel): import('@ai-sdk/provider').LanguageModelV3 {
  const openai = createOpenAI({
    baseURL: normalizeBaseUrl(model.baseUrl),
    apiKey: model.apiKey,
    fetch: patchNullContentFetch,
  });
  return openai.chat(model.modelId);
}

// Some OpenAI-compatible APIs (e.g. DashScope) reject `content: null` on
// assistant messages.
const patchNullContentFetch: typeof globalThis.fetch = async (input, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const json = JSON.parse(init.body);
      if (Array.isArray(json.messages)) {
        for (const msg of json.messages) {
          if (msg.role === 'assistant' && msg.content === null) {
            msg.content = '';
          }
        }
        init = { ...init, body: JSON.stringify(json) };
      }
    } catch { /* not JSON, pass through */ }
  }
  const res = await globalThis.fetch(input, init);
  if (!res.ok) {
    const cloned = res.clone();
    const body = await cloned.text().catch(() => '');
    console.error('[model-protocols] upstream error', {
      status: res.status,
      url: typeof input === 'string' ? input : (input as Request).url,
      body: body.slice(0, 500),
    });
  }
  return res;
};

// ── Text generation (via Vercel AI SDK) ──

function mapFinishReason(raw: string | undefined): GenerationFinishReason | undefined {
  switch (raw) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'content-filter': return 'content_filter';
    case 'tool-calls': return 'tool_use';
    case undefined: return undefined;
    default: return 'other';
  }
}

export async function generateText(
  model: ResolvedModel,
  request: TextGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<TextGenerationResponse> {
  const provider = createProvider(model);

  // Convert OpenAI-style tool definitions to Vercel AI SDK v6 tool format
  const tools: Record<string, ReturnType<typeof tool>> | undefined =
    request.tools?.length
      ? Object.fromEntries(
          request.tools.map((t) => [
            t.function.name,
            tool({
              description: t.function.description,
              inputSchema: jsonSchema(t.function.parameters as any),
            }),
          ]),
        )
      : undefined;

  // Extract system messages and convert the rest to Vercel AI SDK format
  const systemParts: string[] = [];
  const nonSystemMessages = request.messages.filter((m: any) => {
    if (m.role === 'system') { systemParts.push(m.content); return false; }
    return true;
  });

  // Build a toolCallId → toolName lookup from assistant messages
  const toolNameMap = new Map<string, string>();
  for (const m of nonSystemMessages) {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      for (const tc of m.toolCalls) toolNameMap.set(tc.id, tc.name);
    }
  }

  const messages = nonSystemMessages.map((m: any) => {
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant' as const,
        content: [
          ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
          ...m.toolCalls.map((tc: any) => {
            let input: unknown = {};
            if (tc.arguments) {
              if (typeof tc.arguments === 'object') {
                input = tc.arguments;
              } else {
                try {
                  input = JSON.parse(tc.arguments);
                } catch {
                  const lastBrace = tc.arguments.lastIndexOf('{');
                  if (lastBrace > 0) {
                    try { input = JSON.parse(tc.arguments.slice(lastBrace)); } catch { /* keep {} */ }
                  }
                }
              }
            }
            return {
              type: 'tool-call' as const,
              toolCallId: tc.id,
              toolName: tc.name,
              input,
            };
          }),
        ],
      };
    }
    if (m.role === 'tool') {
      return {
        role: 'tool' as const,
        content: [{
          type: 'tool-result' as const,
          toolCallId: m.toolCallId,
          toolName: m.toolName || toolNameMap.get(m.toolCallId) || '',
          output: { type: 'text' as const, value: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) },
        }],
      };
    }
    return { role: m.role, content: m.content };
  });

  let result;
  try {
    result = await aiGenerateText({
      model: provider,
      system: systemParts.length ? systemParts.join('\n') : undefined,
      messages,
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      tools,
      abortSignal: ctx?.signal,
    });
  } catch (err) {
    // The AI SDK surfaces HTTP failures as AI_APICallError; normalize to the
    // ProtocolHttpError contract every other path in this package throws.
    if (APICallError.isInstance(err)) {
      const status = err.statusCode ?? 500;
      throw new ProtocolHttpError(err.message, status, err.responseBody?.slice(0, 500));
    }
    throw err;
  }

  const toolCalls = result.toolCalls?.length
    ? result.toolCalls.map((tc: any) => ({
        id: tc.toolCallId as string,
        name: tc.toolName as string,
        arguments: typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input),
      }))
    : undefined;

  return {
    model: model.modelId,
    text: result.text ?? '',
    finishReason: mapFinishReason(result.finishReason),
    usage: result.usage
      ? {
          promptTokens: result.usage.inputTokens ?? undefined,
          completionTokens: result.usage.outputTokens ?? undefined,
          totalTokens: result.usage.totalTokens ?? undefined,
        }
      : undefined,
    toolCalls,
  };
}

// ── Image generation (POST /images/generations or /images/edits) ──
// Kept as direct HTTP — Vercel AI SDK does not cover image generation.

type OpenAiImageResponse = {
  data?: Array<{ url?: string; b64_json?: string; b64Json?: string; base64?: string }>;
};

export async function generateImage(
  model: ResolvedModel,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  if (request.image) {
    return editImage(model, request, ctx);
  }
  return generateFromPrompt(model, request, ctx);
}

async function generateFromPrompt(
  model: ResolvedModel,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  const baseUrl = normalizeBaseUrl(model.baseUrl);
  const body: Record<string, unknown> = {
    model: model.modelId,
    prompt: request.prompt,
    n: request.n ?? 1,
    response_format: 'b64_json',
  };
  if (request.size) body.size = request.size;
  if (request.quality) body.quality = request.quality;
  if (request.background) body.background = request.background;
  if (request.outputFormat) body.output_format = request.outputFormat;

  const raw = await withRetry(
    () => postJson<OpenAiImageResponse>({
      url: `${baseUrl}/images/generations`,
      headers: { authorization: `Bearer ${model.apiKey}` },
      body,
      signal: ctx?.signal,
    }),
    { signal: ctx?.signal },
  );
  return buildImageResponse(model, raw);
}

async function editImage(
  model: ResolvedModel,
  request: ImageGenerationRequest,
  ctx?: ProtocolCallContext,
): Promise<ImageGenerationResponse> {
  if (!request.image || !('b64Json' in request.image)) throw new ProtocolHttpError('editImage requires base64 image input', 500);
  const baseUrl = normalizeBaseUrl(model.baseUrl);

  const raw = await withRetry(
    () => {
      const form = new FormData();
      form.set('model', model.modelId);
      form.set('prompt', request.prompt);
      form.set('image', base64ToBlob(request.image!.b64Json, request.image!.mimeType), 'image.png');
      if (request.mask && 'b64Json' in request.mask) {
        form.set('mask', base64ToBlob(request.mask.b64Json, request.mask.mimeType), 'mask.png');
      }
      if (request.n !== undefined) form.set('n', String(request.n));
      if (request.size) form.set('size', request.size);

      return postMultipart<OpenAiImageResponse>({
        url: `${baseUrl}/images/edits`,
        headers: { authorization: `Bearer ${model.apiKey}` },
        formData: form,
        signal: ctx?.signal,
      });
    },
    { signal: ctx?.signal },
  );
  return buildImageResponse(model, raw);
}

async function buildImageResponse(model: ResolvedModel, raw: OpenAiImageResponse): Promise<ImageGenerationResponse> {
  const response: ImageGenerationResponse = {
    model: model.modelId,
    images: (raw.data ?? []).map((img) => ({
      url: img.url,
      b64Json: img.b64_json ?? img.b64Json ?? img.base64,
    })),
  };
  return normalizeImageResponse(response);
}

