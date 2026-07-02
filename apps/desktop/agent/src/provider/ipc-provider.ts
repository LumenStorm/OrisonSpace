import type { SessionMessage, ToolCall, ToolDefinition } from '../types';
import type { CacheConfig } from '../context/contextManager';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface GenerateOptions {
  modelRef?: { keyId: string; modelId: string };
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResult {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string;
}

export interface GenerateTextRequest {
  ref: { keyId: string; modelId: string };
  request: {
    model: string;
    messages: unknown[];
    temperature?: number;
    maxTokens?: number;
    tools?: unknown[];
  };
}

export type GenerateTextFn = (body: GenerateTextRequest, abort: AbortSignal) => Promise<{
  text?: string;
  content?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  finishReason?: string;
}>;

let _generateText: GenerateTextFn | undefined;

export function setGenerateTextFn(fn: GenerateTextFn) {
  _generateText = fn;
}

function messagesToPayload(messages: SessionMessage[], system: string, tools: ToolDefinition[], cacheConfig?: CacheConfig) {
  // NOTE: Prompt caching (e.g. Anthropic's cache_control) is not currently
  // supported by the ai-sdk generateText path. The cacheConfig is retained in
  // the interface for future provider-level integration.
  const formatted: unknown[] = [{
    role: 'system',
    content: system,
  }];

  // Inject pinned context as a stable prefix (benefits from prompt caching when supported)
  if (cacheConfig?.pinnedContent) {
    formatted.push({
      role: 'user',
      content: `[Pinned Context]\n${cacheConfig.pinnedContent}`,
    });
    formatted.push({
      role: 'assistant',
      content: 'Acknowledged.',
    });
  }

  // Inject compacted summary of earlier conversation
  if (cacheConfig?.compactedSummary) {
    formatted.push({
      role: 'user',
      content: `<history_summary readonly="true">\n${cacheConfig.compactedSummary}\n</history_summary>`,
    });
    formatted.push({
      role: 'assistant',
      content: 'Understood. I will continue based on the context above.',
    });
  }

  for (const m of messages) {
    if (m.role === 'assistant') {
      formatted.push({
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls?.length && {
          toolCalls: m.toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          })),
        }),
      });
    } else if (m.role === 'tool' && m.toolResults?.length) {
      for (const tr of m.toolResults) {
        formatted.push({
          role: 'tool',
          toolCallId: tr.toolCallId,
          toolName: tr.toolName,
          content: tr.output,
        });
      }
    } else if (m.role === 'tool') {
      // Skip tool messages without results
    } else {
      formatted.push({ role: m.role, content: m.content });
    }
  }

  const toolDefs = tools.map(t => {
    const { $schema: _$schema, ...schema } = zodToJsonSchema(t.parameters, { target: 'jsonSchema7' }) as Record<string, unknown>;
    return {
      type: 'function' as const,
      function: {
        name: t.id,
        description: t.description,
        parameters: schema,
      },
    };
  });

  return { messages: formatted, tools: toolDefs.length > 0 ? toolDefs : undefined };
}

export async function generate(
  messages: SessionMessage[],
  system: string,
  tools: ToolDefinition[],
  abortSignal: AbortSignal,
  opts: GenerateOptions = {},
  cacheConfig?: CacheConfig,
): Promise<GenerateResult> {
  if (!_generateText) throw new Error('generateText not initialized — call setGenerateTextFn first');

  const payload = messagesToPayload(messages, system, tools, cacheConfig);

  const body: GenerateTextRequest = {
    ref: opts.modelRef ?? { keyId: 'default', modelId: 'default' },
    request: {
      model: opts.modelRef?.modelId ?? 'default',
      messages: payload.messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      tools: payload.tools,
    },
  };

  const data = await _generateText(body, abortSignal);

  const toolCalls: ToolCall[] | undefined = data.toolCalls?.map(tc => ({
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
  }));

  return {
    content: data.text ?? data.content ?? '',
    toolCalls,
    finishReason: data.finishReason ?? 'stop',
  };
}
