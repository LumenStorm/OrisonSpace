import type { SessionMessage, ToolCall, ToolDefinition } from '../types';
import { env } from '../env';
import { logger } from '../logger';
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

function messagesToPayload(messages: SessionMessage[], system: string, tools: ToolDefinition[]) {
  const formatted: unknown[] = [{ role: 'system', content: system }];

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
      // Each tool result becomes a separate tool message
      for (const tr of m.toolResults) {
        formatted.push({
          role: 'tool',
          toolCallId: tr.toolCallId,
          content: tr.output,
        });
      }
    } else {
      formatted.push({ role: m.role, content: m.content });
    }
  }

  const toolDefs = tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.id,
      description: t.description,
      parameters: zodToJsonSchema(t.parameters, { target: 'openApi3' }),
    },
  }));

  return { messages: formatted, tools: toolDefs.length > 0 ? toolDefs : undefined };
}

export async function generate(
  messages: SessionMessage[],
  system: string,
  tools: ToolDefinition[],
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const payload = messagesToPayload(messages, system, tools);

  const body = {
    ref: opts.modelRef ?? { keyId: 'default', modelId: 'default' },
    request: {
      model: opts.modelRef?.modelId ?? 'default',
      messages: payload.messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      tools: payload.tools,
    },
  };

  const res = await fetch(`${env.MODEL_GATEWAY_URL}/model/generate-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Model gateway error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    text?: string;
    content?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: string }>;
    finishReason?: string;
  };

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
