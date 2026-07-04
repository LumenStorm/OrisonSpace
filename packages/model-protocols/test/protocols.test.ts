import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedModel } from '@orison/shared-contracts';
import { generateText, generateImage, ProtocolHttpError } from '../src';

const ORIGINAL_FETCH = globalThis.fetch;

type CapturedCall = { url: string; init?: RequestInit };

function buildMock(captured: CapturedCall[], body: unknown, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function model(overrides: Partial<ResolvedModel> = {}): ResolvedModel {
  return {
    keyId: 'k1',
    modelId: 'gpt-4o',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.openai.com',
    apiKey: 'sk-test',
    capability: 'text',
    ...overrides,
  };
}

describe('unified protocol', () => {
  let captured: CapturedCall[];

  beforeEach(() => { captured = []; });
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

  describe('generateText', () => {
    it('posts to /chat/completions with Bearer auth', async () => {
      globalThis.fetch = buildMock(captured, {
        choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      const result = await generateText(model(), {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.7,
        maxTokens: 256,
      });

      expect(captured[0].url).toBe('https://api.openai.com/v1/chat/completions');
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body.model).toBe('gpt-4o');
      expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
      expect(result.text).toBe('hello');
      expect(result.finishReason).toBe('stop');
      expect(result.usage?.totalTokens).toBe(30);
    });

    it('throws ProtocolHttpError on non-2xx', async () => {
      globalThis.fetch = buildMock(captured, { error: { message: 'bad key' } }, 401);
      await expect(
        generateText(model(), { model: 'gpt-4o', messages: [{ role: 'user', content: 'x' }] }),
      ).rejects.toBeInstanceOf(ProtocolHttpError);
    });

    it('posts Anthropic-compatible text requests to /messages with x-api-key auth', async () => {
      globalThis.fetch = buildMock(captured, {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-latest',
        content: [{ type: 'text', text: 'hello from claude' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 11, output_tokens: 7 },
      });

      const result = await generateText(
        model({
          protocol: 'anthropic-compatible',
          modelId: 'claude-3-5-sonnet-latest',
          baseUrl: 'https://api.anthropic.com',
        }),
        {
          model: 'claude-3-5-sonnet-latest',
          messages: [
            { role: 'system', content: 'You are concise.' },
            { role: 'user', content: 'hi' },
          ],
          maxTokens: 256,
        },
      );

      expect(captured[0].url).toBe('https://api.anthropic.com/v1/messages');
      const headers = captured[0].init?.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('sk-test');
      expect(headers['anthropic-version']).toBeTruthy();
      expect(headers.authorization).toBeUndefined();
      const body = JSON.parse((captured[0].init?.body as string) ?? '{}');
      expect(body).toMatchObject({
        model: 'claude-3-5-sonnet-latest',
        system: 'You are concise.',
        max_tokens: 256,
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(result).toEqual({
        model: 'claude-3-5-sonnet-latest',
        text: 'hello from claude',
        finishReason: 'stop',
        usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
      });
    });
  });

  describe('generateImage', () => {
    it('posts to /images/generations for prompt-only requests', async () => {
      globalThis.fetch = buildMock(captured, {
        data: [{ b64_json: 'AAAA' }],
      });

      const result = await generateImage(
        model({ modelId: 'dall-e-3', capability: 'image' }),
        { model: 'dall-e-3', prompt: 'a cat' },
      );

      expect(captured[0].url).toBe('https://api.openai.com/v1/images/generations');
      expect(result.images[0].b64Json).toBe('AAAA');
    });

    it('posts to /images/edits when image is provided', async () => {
      globalThis.fetch = buildMock(captured, {
        data: [{ b64_json: 'BBBB' }],
      });

      await generateImage(
        model({ modelId: 'gpt-image-1', capability: 'image' }),
        { model: 'gpt-image-1', prompt: 'edit', image: { b64Json: 'YWJj', mimeType: 'image/png' } },
      );

      expect(captured[0].url).toBe('https://api.openai.com/v1/images/edits');
    });
  });

});
